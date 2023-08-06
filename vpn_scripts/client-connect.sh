#!/bin/bash

set -x

export $(grep -v '^#' /tmp/vpn-scripts-env | xargs)

env

echo "Client connected"
echo "Name: ${common_name}"
echo "Internal ip: ${ifconfig_pool_remote_ip}"
echo "Public ip: ${trusted_ip}"

node /etc/openvpn/scripts/start-proxy.js
