#!/bin/bash

set -x

env

export VPN_CLIENT_IP=$ifconfig_pool_remote_ip
export VPN_CONFIG_NAME=$common_name

# export POD_NAME=$(echo "tinyproxy-${VPN_CONFIG_NAME}-${VPN_CLIENT_IP}-" | awk '{print tolower($0)}')
# export POD_MATCH='^tinyproxy-'"$VPN_CLIENT_IP"'-'

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

export EXISTING_PODS=$(curl --cacert ${CACERT} -H "Authorization: Bearer ${TOKEN}" "${APISERVER}/api/v1/namespaces/${NAMESPACE}/pods" | jq -r ".items[].metadata.name")
 
for POD_NAME in $EXISTING_PODS
do
    echo "Pod: $POD_NAME"

    if [[ $POD_NAME =~ $POD_MATCH ]]; then
        echo "Removing: $POD_NAME"

        curl -k -X DELETE -H "Authorization: Bearer ${TOKEN}" \
            "${APISERVER}/api/v1/namespaces/${NAMESPACE}/pods/${POD_NAME}"
    fi
done

echo "Client disconnected"
echo "Name: ${common_name}"
echo "Internal ip: ${ifconfig_pool_remote_ip}"
echo "Public ip: ${trusted_ip}"
