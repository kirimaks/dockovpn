"use strict"

const axios = require('axios');
const https = require('https');


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

(async function cleanProxy() {
    const namespace = process.env.NAMESPACE || envError('NAMESPACE not defined');
    const apiserver = process.env.APISERVER || envError('APISERVER not defined');
    const apiToken = process.env.TOKEN || envError('TOKEN not defined');
    const podMatch = process.env.POD_MATCH || envError('POD_MATCH not defined');

    try {
        await stopProxy(apiserver, namespace, apiToken, podMatch);

    } catch(error) {
        console.error(`Cannot stop proxy: ${error}`);
    }

})();
