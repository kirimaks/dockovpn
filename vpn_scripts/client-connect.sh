#!/bin/bash

set -x

env

echo "Client connected"
echo "Name: ${common_name}"
echo "Internal ip: ${ifconfig_pool_remote_ip}"
echo "Public ip: ${trusted_ip}"
