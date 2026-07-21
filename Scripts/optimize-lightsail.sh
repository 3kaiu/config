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
# 5. 总结
# ============================================
echo ""
echo "======================================"
echo "✅ 优化完成!"
echo ""
echo "📋 当前网络参数:"
echo "   拥塞控制: $(sysctl -n net.ipv4.tcp_congestion_control)"
echo "   队列算法: $(sysctl -n net.core.default_qdisc)"
echo "   TCP Fast Open: $(sysctl -n net.ipv4.tcp_fastopen)"
echo "   rmem_max: $(sysctl -n net.core.rmem_max) bytes"
echo "   wmem_max: $(sysctl -n net.core.wmem_max) bytes"
echo ""
echo "💡 后续建议:"
echo "   1. 重启节点服务使 BBR + TFO 生效 (systemctl restart <你的节点服务>)"
echo "   2. 如用 sing-box, 确认配置中 transport 已开启 tcp_fast_open: true"
echo "   3. 如 SS 被运营商限速, 考虑换 Trojan/VLESS+TLS+WS 协议"
echo "   4. 跨国链路质量波动属正常, BBR 会自适应调节窗口"
