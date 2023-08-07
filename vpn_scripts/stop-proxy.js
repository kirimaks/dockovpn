"use strict"

const axios = require('axios');
const https = require('https');

const redisTools = require('./redis-tools');


async function stopProxy(apiserver, namespace, apiToken, podMatch) {
    const existingPodsOptions = {
        url: `${apiserver}/api/v1/namespaces/${namespace}/pods`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${apiToken}` },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    };

    const existinPodsResp = await axios(existingPodsOptions);
    const podNameRegex = new RegExp(podMatch);

    for (const pod of existinPodsResp.data.items) {
        const podName = pod.metadata.name;

        if (podNameRegex.test(podName)) {
            const deleteOptions = {
                url: `${apiserver}/api/v1/namespaces/${namespace}/pods/${podName}`,
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${apiToken}` },
                httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            }
            const deletePodResp = await axios(deleteOptions);

            console.log(`Pod ${podName} deleted: ${deletePodResp.data}`);
        }
    }
}

async function updateRedisRecord(vpnConfigName, vpnClientIp) {
    const redisHost = process.env.REDIS_HOST || envError('REDIS_HOST not defined');
    const redisPort = process.env.REDIS_PORT || envError('REDIS_PORT not defined');
    const redisPass = process.env.REDIS_PASS || envError('REDIS_PASS not defined');
    const redisDb = process.env.REDIS_DB || envError('REDIS_DB not defined');

    const redis = redisTools.getRedisClient(redisHost, redisPort, redisPass, redisDb);
    const proxyNodeKey = redisTools.getProxyNodeKey(vpnConfigName);

    const savedIp = await redis.hget(proxyNodeKey, 'localIp');

    if (savedIp === vpnClientIp) {
        const nodeDetails = {
            name: vpnConfigName,
            localIp: vpnClientIp,
            publicIp: '',
            status: 'offline',
            httpSessions: 0,
            uptime: '',
            httpInternalPort: 0
        };

        await redis.hset(proxyNodeKey, nodeDetails);
    }

    await redis.disconnect();
}

(async function cleanProxy() {
    const namespace = process.env.NAMESPACE || envError('NAMESPACE not defined');
    const apiserver = process.env.APISERVER || envError('APISERVER not defined');
    const apiToken = process.env.TOKEN || envError('TOKEN not defined');
    const podMatch = process.env.POD_MATCH || envError('POD_MATCH not defined');

    const vpnClientIp = process.env.VPN_CLIENT_IP || envError('VPN_CLIENT_IP not defined');
    const vpnConfigName = process.env.VPN_CONFIG_NAME || envError('VPN_CONFIG_NAME not defined');

    try {
        await stopProxy(apiserver, namespace, apiToken, podMatch);

    } catch(error) {
        console.error(`Cannot stop proxy: ${error}`);
    }

    try {
        await updateRedisRecord(vpnConfigName, vpnClientIp);

    } catch(error) {
        console.error(`Cannot update redis record: ${error}`);
    }

})();
