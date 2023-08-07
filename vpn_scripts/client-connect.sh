#!/bin/bash

set -x

export $(grep -v '^#' /tmp/vpn-scripts-env | xargs)

env

export VPN_CLIENT_IP=$ifconfig_pool_remote_ip
export VPN_CONFIG_NAME=$common_name
export POD_IP=$(hostname -i)

# Point to the internal API server hostname
export APISERVER=https://kubernetes.default.svc

# Path to ServiceAccount token
export SERVICEACCOUNT=/var/run/secrets/kubernetes.io/serviceaccount

# Read this Pod's namespace
export NAMESPACE=$(cat ${SERVICEACCOUNT}/namespace)

# Read the ServiceAccount bearer token
export TOKEN=$(cat ${SERVICEACCOUNT}/token)

# Reference the internal certificate authority (CA)
export CACERT=${SERVICEACCOUNT}/ca.crt

export POD_NAME=$(echo "tinyproxy-${VPN_CONFIG_NAME}-${VPN_CLIENT_IP}-" | awk '{print tolower($0)}')

echo "Client connected"
echo "Name: ${common_name}"
echo "Internal ip: ${ifconfig_pool_remote_ip}"
echo "Public ip: ${trusted_ip}"

node /etc/openvpn/scripts/start-proxy.js
