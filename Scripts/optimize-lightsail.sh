#!/bin/bash
# AWS Lightsail Tokyo 网络质量优化脚本
# 用法: sudo bash optimize-lightsail.sh
# 适用系统: Ubuntu 20.04/22.04 LTS (AWS Lightsail 默认)

set -e

echo "🚀 AWS Lightsail Tokyo 网络质量优化"
echo "======================================"

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then
  echo "❌ 请用 root 运行: sudo bash optimize-lightsail.sh"
  exit 1
fi

# 备份原始 sysctl 配置
cp -n /etc/sysctl.conf /etc/sysctl.conf.bak 2>/dev/null || true
echo "✅ 已备份 /etc/sysctl.conf -> /etc/sysctl.conf.bak"

# ============================================
# 1. 开启 BBR 拥塞控制算法
# ============================================
echo ""
echo ">>> 开启 BBR 拥塞控制..."

# 检查内核版本 (BBR 需要 4.9+)
KERNEL_VERSION=$(uname -r | cut -d. -f1-2)
echo "当前内核版本: $KERNEL_VERSION"

# 写入 BBR 配置
cat > /etc/sysctl.d/99-bbr.conf << 'EOF'
# BBR 拥塞控制 (Google 开发, 比 cubic 更适合高延迟链路)
net.core.default_qdisc = fq
net.ipv4.tcp_congestion_control = bbr

# TCP 缓冲区调优 (AWS Lightsail 默认较小, 需放大)
# 16MB/64MB/128MB 梯度缓冲, 适配跨国长肥管道 (LFN)
net.core.rmem_max = 67108864
net.core.wmem_max = 67108864
net.core.rmem_default = 1048576
net.core.wmem_default = 1048576
net.core.netdev_max_backlog = 5000
net.core.somaxconn = 4096

# TCP 窗口缩放与缓冲
net.ipv4.tcp_rmem = 4096 87380 67108864
net.ipv4.tcp_wmem = 4096 65536 67108864
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_timestamps = 1
net.ipv4.tcp_sack = 1

# TCP Fast Open (减少一个 RTT 握手)
# 需服务端程序支持 (sing-box/ss-rust 支持)
net.ipv4.tcp_fastopen = 3

# 连接复用与保活
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_intvl = 30
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_reuse2 = 1

# 减少超时重传等待 (RTO 初始值, 跨国链路适当放大)
net.ipv4.tcp_min_tso_segs = 2
net.ipv4.tcp_slow_start_after_idle = 0

# 开启 MTU 探测 (避免 PMTU 黑洞)
net.ipv4.tcp_mtu_probing = 1

# UDP 缓冲区 (影响 DNS/QUIC/Hysteria 等 UDP 协议)
net.core.rmem_default = 1048576
net.core.wmem_default = 1048576
EOF

sysctl --system > /dev/null 2>&1
echo "✅ BBR + TCP 缓冲区调优已应用"

# 验证 BBR 生效
CONGESTION=$(sysctl -n net.ipv4.tcp_congestion_control)
if echo "$CONGESTION" | grep -q "bbr"; then
  echo "✅ BBR 已生效: $CONGESTION"
else
  echo "⚠️ BBR 未生效 (当前: $CONGESTION), 可能内核版本过低或未编译 BBR 模块"
  echo "   Lightsail Ubuntu 20.04+ 通常已内置, 如未生效请检查内核: uname -r"
fi

# ============================================
# 2. 系统文件描述符限制提升
# ============================================
echo ""
echo ">>> 提升文件描述符上限..."
cat > /etc/security/limits.d/99-proxy.conf << 'EOF'
* soft nofile 65535
* hard nofile 65535
root soft nofile 65535
root hard nofile 65535
EOF
echo "✅ 文件描述符上限提升至 65535"

# ============================================
# 3. 优化 SSH (减少管理连接延迟)
# ============================================
echo ""
echo ">>> 优化 SSH 配置..."
if [ -f /etc/ssh/sshd_config ]; then
  cp -n /etc/ssh/sshd_config /etc/ssh/sshd_config.bak 2>/dev/null || true
  sed -i 's/^#*ClientAliveInterval.*/ClientAliveInterval 60/' /etc/ssh/sshd_config
  sed -i 's/^#*ClientAliveCountMax.*/ClientAliveCountMax 3/' /etc/ssh/sshd_config
  grep -q "^ClientAliveInterval" /etc/ssh/sshd_config || echo "ClientAliveInterval 60" >> /etc/ssh/sshd_config
  grep -q "^ClientAliveCountMax" /etc/ssh/sshd_config || echo "ClientAliveCountMax 3" >> /etc/ssh/sshd_config
  echo "✅ SSH keepalive 已优化 (60s 间隔, 3 次探测)"
fi

# ============================================
# 4. 检查并提示 swap (Lightsail 低配机型可能缺 swap)
# ============================================
echo ""
echo ">>> 检查 swap..."
SWAP_SIZE=$(swapon --show=SIZE --bytes --noheadings 2>/dev/null | head -1)
if [ -z "$SWAP_SIZE" ]; then
  echo "⚠️ 当前无 swap, 低配 Lightsail (512MB/1GB) 建议创建 swap 文件"
  echo "   是否创建 1GB swap? (y/N)"
  read -r response
  if [ "$response" = "y" ] || [ "$response" = "Y" ]; then
    fallocate -l 1G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo "/swapfile none swap sw 0 0" >> /etc/fstab
    echo "✅ 已创建 1GB swap"
  fi
else
  echo "✅ swap 已存在"
fi

# ============================================
# 5. Hysteria2 专用 UDP 缓冲区优化
# ============================================
echo ""
echo ">>> Hysteria2 UDP 缓冲区优化..."

# Hysteria2 是 QUIC/UDP 协议, 对 UDP 缓冲区要求极高
# 默认 UDP 缓冲区通常只有 208KB, 远不够 Hysteria2 的高速传输
# 已在 BBR 配置中设置 rmem_max/wmem_max = 64MB, 此处额外确认 UDP 层
cat > /etc/sysctl.d/99-hysteria-udp.conf << 'EOF'
# Hysteria2 (QUIC/UDP) 专用 UDP 缓冲区优化
# QUIC 使用 UDP, 默认 UDP 缓冲区远小于 TCP, 是 Hysteria2 限速的常见原因
net.core.rmem_max = 67108864
net.core.wmem_max = 67108864
net.core.rmem_default = 1048576
net.core.wmem_default = 1048576

# UDP 收发缓冲队列 (防止高吞吐下丢包)
net.core.netdev_max_backlog = 5000

# conntrack 表 (VLESS+Reality 的 TCP 连接跟踪)
# 默认 65536 可能不够, 放大防止连接跟踪表满导致丢包
net.netfilter.nf_conntrack_max = 262144
net.ipv4.tcp_max_tw_buckets = 32768
EOF

# 应用 (如果 sysctl --system 报错某些 key 不存在, 忽略)
sysctl --system 2>/dev/null || sysctl -p /etc/sysctl.d/99-hysteria-udp.conf 2>/dev/null || true
echo "✅ Hysteria2 UDP 缓冲区已优化 (rmem/wmem = 64MB)"

# ============================================
# 6. 总结
# ============================================
echo ""
echo "======================================"
echo "✅ 优化完成!"
echo ""
echo "📋 当前网络参数:"
echo "   拥塞控制: $(sysctl -n net.ipv4.tcp_congestion_control)"
echo "   队列算法: $(sysctl -n net.core.default_qdisc)"
echo "   TCP Fast Open: $(sysctl -n net.ipv4.tcp_fastopen)"
echo "   UDP rmem_max: $(sysctl -n net.core.rmem_max) bytes"
echo "   UDP wmem_max: $(sysctl -n net.core.wmem_max) bytes"
echo "   MTU 探测: $(sysctl -n net.ipv4.tcp_mtu_probing)"
echo ""
echo "💡 Hysteria2 + VLESS+Reality 服务端建议:"
echo "   1. 重启节点服务使 BBR + 缓冲区调优生效:"
echo "      systemctl restart sing-box  (或你的节点服务名)"
echo ""
echo "   2. Hysteria2 服务端配置确认 (sing-box):"
echo "      - up_mbps / down_mbps 不要设得太高 (设为实际带宽的 80%)"
echo "        过高会导致 QUIC 拥塞控制失效, 反而浪费流量"
echo "      - 如用 sing-box, hysterias 配置中可设:"
echo "        recv_idle_timeout: 30s  (空闲超时断开, 省流量)"
echo "        send_idle_timeout: 30s"
echo ""
echo "   3. VLESS+Reality 服务端配置确认:"
echo "      - flow: xtls-rprx-vision (Vision 流控, 减少 TLS 加密开销)"
echo "      - transport: 无需额外 WS/gRPC, Vision 直接 TCP 性能最佳"
echo "      - reality 的 dest 建议用真实大站 (如 www.microsoft.com:443)"
echo ""
echo "   4. 流量节省关键点:"
echo "      - Hysteria2 的 up/down bandwidth 建议设为 VPS 实际带宽"
echo "        Lightsail $5 套餐 = 1TB/月流量, 带宽约 500Mbps 突发"
echo "        建设设 down_mbps: 50, up_mbps: 20 (保守值)"
echo "        过高会导致服务端发包过快, 客户端来不及收 → 重传浪费流量"
echo "      - VLESS+Reality 的 TCP 流量天然比 Hysteria2 省 (无 QUIC 额外开销)"
echo "      - 弱网下建议切到 VLESS (TCP BBR 比 QUIC BBR 更成熟)"
echo ""
echo "   5. 跨国链路质量波动属正常, BBR 会自适应调节窗口"
