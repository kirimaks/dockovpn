#!/bin/bash

set -x

export $(grep -v '^#' /tmp/vpn-scripts-env | xargs)

# env

export VPN_CLIENT_IP=$ifconfig_pool_remote_ip
export VPN_CONFIG_NAME=$common_name

VPN_CONFIG_NAME_LOW=$(echo $VPN_CONFIG_NAME | awk '{print tolower($0)}')
export POD_MATCH='^tinyproxy-'"$VPN_CONFIG_NAME_LOW"'-'"$VPN_CLIENT_IP"''

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

node /etc/openvpn/scripts/stop-proxy.js

echo "<< Client disconnected: ${common_name}/${ifconfig_pool_remote_ip} >>"
