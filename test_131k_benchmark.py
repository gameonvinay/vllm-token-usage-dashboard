import time
import json
import urllib.request
import subprocess
import threading

SERVER_URL = "http://127.0.0.1:8000"

def get_metrics():
    try:
        req = urllib.request.Request(f"{SERVER_URL}/metrics")
        with urllib.request.urlopen(req, timeout=5) as res:
            text = res.read().decode('utf-8')
            m = {}
            for line in text.splitlines():
                if line.startswith('#') or not line.strip():
                    continue
                parts = line.split()
                if len(parts) >= 2:
                    k = parts[0].split('{')[0]
                    try:
                        m[k] = float(parts[-1])
                    except:
                        pass
            return m
    except Exception as e:
        return {'error': str(e)}

def get_gpu_telemetry():
    try:
        out = subprocess.check_output([
            'nvidia-smi',
            '--query-gpu=name,memory.used,memory.total,power.draw,utilization.gpu,temperature.gpu',
            '--format=csv,noheader,nounits'
        ], text=True).strip()
        parts = [p.strip() for p in out.split(',')]
        return {
            'vram_used_gb': round(float(parts[1]) / 1024, 2),
            'vram_total_gb': round(float(parts[2]) / 1024, 2),
            'power_w': round(float(parts[3]), 1),
            'util_pct': float(parts[4]),
            'temp_c': float(parts[5])
        }
    except:
        return {}

def generate_131k_prompt():
    # Build text that tokenizes to ~131,072 tokens
    base_paragraph = (
        "In modern machine learning research, processing ultra-long contexts is critical for needle-in-a-haystack retrieval, "
        "codebase repository understanding, multi-turn reasoning, and document analysis. "
        "The NVIDIA GeForce RTX 5090 Blackwell GPU with 32GB high-speed GDDR7 VRAM and 24,000 FP8 tensor cores "
        "accelerates flash attention and multi-token prediction speculative decoding. "
        "This benchmark tests prompt prefill throughput, kv cache allocation, and decoding stability across multiple rounds. "
    )
    # Target ~530,000 characters
    multiplier = int(530000 / len(base_paragraph)) + 1
    content = (base_paragraph * multiplier)[:535000]
    content += "\n\nSummarize the key architecture and give a 1-sentence confirmation that the 131k context was ingested successfully."
    return content

def run_benchmark():
    print("=" * 70)
    print("🚀 STARTING 131K PROMPT BENCHMARK (3 CONTINUOUS ROUNDS)")
    print("=" * 70)
    
    print("\n[1/4] Generating ~131K token synthetic payload...")
    prompt_text = generate_131k_prompt()
    print(f"       Payload size: {len(prompt_text):,} characters (~131,000 tokens)")

    rounds_data = []

    for round_num in range(1, 4):
        print(f"\n" + "-" * 70)
        print(f"🔥 ROUND {round_num} / 3: INGESTING 131K PROMPT")
        print("-" * 70)

        # Baseline metrics
        m_before = get_metrics()
        p_tokens_before = m_before.get('llamacpp:prompt_tokens_total', 0)
        p_sec_before = m_before.get('llamacpp:prompt_seconds_total', 0)
        g_tokens_before = m_before.get('llamacpp:tokens_predicted_total', 0)
        g_sec_before = m_before.get('llamacpp:tokens_predicted_seconds_total', 0)
        draft_before = m_before.get('llamacpp:spec_decode_num_draft_tokens_total', 0)
        accepted_before = m_before.get('llamacpp:spec_decode_num_accepted_tokens_total', 0)

        gpu_snapshots = []
        stop_telemetry = False

        def poll_gpu():
            while not stop_telemetry:
                tel = get_gpu_telemetry()
                if tel:
                    gpu_snapshots.append(tel)
                time.sleep(0.5)

        t_mon = threading.Thread(target=poll_gpu)
        t_mon.daemon = True
        t_mon.start()

        # Send request
        req_payload = json.dumps({
            "model": "Qwen3.8-27B",
            "messages": [
                {"role": "user", "content": f"[Round {round_num}] " + prompt_text}
            ],
            "max_tokens": 32,
            "temperature": 0.7
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{SERVER_URL}/v1/chat/completions",
            data=req_payload,
            headers={"Content-Type": "application/json"}
        )

        start_time = time.time()
        response_text = ""
        prompt_tokens_reported = 0
        completion_tokens_reported = 0

        try:
            with urllib.request.urlopen(req, timeout=300) as resp:
                res_data = json.loads(resp.read().decode('utf-8'))
                elapsed_wall = time.time() - start_time
                choice = res_data.get('choices', [{}])[0]
                response_text = choice.get('message', {}).get('content', '')
                usage = res_data.get('usage', {})
                prompt_tokens_reported = usage.get('prompt_tokens', 0)
                completion_tokens_reported = usage.get('completion_tokens', 0)
        except Exception as e:
            elapsed_wall = time.time() - start_time
            print(f"❌ Error during request: {e}")

        stop_telemetry = True
        time.sleep(0.6)

        # After metrics
        m_after = get_metrics()
        p_tokens_after = m_after.get('llamacpp:prompt_tokens_total', 0)
        p_sec_after = m_after.get('llamacpp:prompt_seconds_total', 0)
        g_tokens_after = m_after.get('llamacpp:tokens_predicted_total', 0)
        g_sec_after = m_after.get('llamacpp:tokens_predicted_seconds_total', 0)
        draft_after = m_after.get('llamacpp:spec_decode_num_draft_tokens_total', 0)
        accepted_after = m_after.get('llamacpp:spec_decode_num_accepted_tokens_total', 0)

        delta_prompt_tokens = p_tokens_after - p_tokens_before
        delta_prompt_sec = p_sec_after - p_sec_before
        delta_gen_tokens = g_tokens_after - g_tokens_before
        delta_gen_sec = g_sec_after - g_sec_before
        delta_draft = draft_after - draft_before
        delta_accepted = accepted_after - accepted_before

        prefill_speed = (delta_prompt_tokens / delta_prompt_sec) if delta_prompt_sec > 0 else 0
        gen_speed = (delta_gen_tokens / delta_gen_sec) if delta_gen_sec > 0 else 0
        mtp_acc_pct = (delta_accepted / delta_draft * 100) if delta_draft > 0 else 0

        # GPU metrics stats
        max_power = max([g.get('power_w', 0) for g in gpu_snapshots]) if gpu_snapshots else 0
        max_vram = max([g.get('vram_used_gb', 0) for g in gpu_snapshots]) if gpu_snapshots else 0
        max_temp = max([g.get('temp_c', 0) for g in gpu_snapshots]) if gpu_snapshots else 0
        max_util = max([g.get('util_pct', 0) for g in gpu_snapshots]) if gpu_snapshots else 0

        # Estimated AC Wall Power
        wall_power_est = round((max_power + 52 + 88) / 0.925)

        print(f"📊 ROUND {round_num} RESULTS:")
        print(f"   • Prompt Tokens Ingested : {delta_prompt_tokens:,} tokens (Reported: {prompt_tokens_reported:,})")
        print(f"   • Prefill Processing Time: {delta_prompt_sec:.2f} seconds")
        print(f"   • ⚡ PREFILL THROUGHPUT   : {prefill_speed:,.1f} tokens/second")
        print(f"   • Generation Tokens      : {completion_tokens_reported} tokens (Time: {delta_gen_sec:.2f}s)")
        print(f"   • ✨ Generation Speed     : {gen_speed:,.1f} tokens/second")
        if delta_draft > 0:
            print(f"   • 🎯 MTP Acceptance Rate  : {mtp_acc_pct:.1f}% ({delta_accepted}/{delta_draft} draft tokens)")
        print(f"   • Total Request Wall Time: {elapsed_wall:.2f}s")
        print(f"   • ⚡ Peak GPU Power Draw  : {max_power:.1f} W (GPU Util: {max_util}%)")
        print(f"   • 🔌 Est. Total Wall Power: ~{wall_power_est} W (Cooler Master Platinum)")
        print(f"   • 🌡️ Peak GPU Temperature : {max_temp}°C (VRAM Peak: {max_vram} GB / 31.8 GB)")
        print(f"   • Model Output Sample    : {response_text[:120]}...")

        rounds_data.append({
            'round': round_num,
            'prompt_tokens': delta_prompt_tokens,
            'prefill_time_s': delta_prompt_sec,
            'prefill_speed_tok_s': prefill_speed,
            'gen_tokens': completion_tokens_reported,
            'gen_speed_tok_s': gen_speed,
            'mtp_acc_pct': mtp_acc_pct,
            'gpu_power_w': max_power,
            'wall_power_w': wall_power_est,
            'gpu_temp_c': max_temp,
            'vram_gb': max_vram
        })

        if round_num < 3:
            print("\n⏳ Pausing 2 seconds before next round...")
            time.sleep(2)

    print("\n" + "=" * 70)
    print("📈 3-ROUND BENCHMARK SUMMARY")
    print("=" * 70)
    avg_prefill = sum([r['prefill_speed_tok_s'] for r in rounds_data]) / len(rounds_data)
    avg_gen = sum([r['gen_speed_tok_s'] for r in rounds_data]) / len(rounds_data)
    avg_mtp = sum([r['mtp_acc_pct'] for r in rounds_data]) / len(rounds_data)
    peak_wall = max([r['wall_power_w'] for r in rounds_data])
    total_tokens = sum([r['prompt_tokens'] for r in rounds_data])

    print(f" • Total Ingested Tokens across 3 rounds: {total_tokens:,} tokens")
    print(f" • Average Prefill Speed                 : {avg_prefill:,.1f} tokens/s")
    print(f" • Average Generation Speed              : {avg_gen:,.1f} tokens/s")
    print(f" • Average MTP Acceptance Rate           : {avg_mtp:.1f}%")
    print(f" • Peak Total System Power (AC)          : ~{peak_wall} W")
    print("=" * 70)

if __name__ == "__main__":
    run_benchmark()
