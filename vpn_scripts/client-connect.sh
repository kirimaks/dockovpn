#!/bin/bash

set -x

export $(grep -v '^#' /tmp/vpn-scripts-env | xargs) # Define container vars.

export VPN_CLIENT_IP=$ifconfig_pool_remote_ip
export VPN_CONFIG_NAME=$(echo $common_name | awk '{ print tolower($0) }')
export VPN_SERVER_IP=$(hostname -i)

echo "<< Client connecting: ${common_name}/${ifconfig_pool_remote_ip} >>"

NOTIFICATION_RESP=$( \
	curl -X POST "$PROXY_CONTROLLER_BASE_URI/vpn/client-connect" \
	-H 'Content-type: application/json' \
	-d "{ \
			\"vpn_server_ip\": \"${VPN_SERVER_IP}\", \
			\"vpn_client_ip\": \"${VPN_CLIENT_IP}\", \
			\"vpn_config_name\": \"${VPN_CONFIG_NAME}\" \
		} \
	" \
)

NOTIFICATION_RESP_CODE=$(echo $NOTIFICATION_RESP | jq ".statusCode")

if [[ "${NOTIFICATION_RESP_CODE}" -eq "201" ]]; then
	exit 0

else
	echo "Error: proxy controller notification failed"
	exit 1
fi
