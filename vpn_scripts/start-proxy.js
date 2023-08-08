"use strict"

const { MongoClient } = require('mongodb');
const axios = require('axios');
const https = require('https');

const redisTools = require('./redis-tools');

const PROXY_DB = 'proxyPool';
const PROXY_COLLECTION = 'proxy';

function envError(errorText) {
    throw new Error(errorText);
}

function getConnectionString() {
    const mongoUser = process.env.MONGOUSER || envError('MONGOUSER not defined');
    const mongoPass = process.env.MONGOPASS || envError('MONGOPASS not defined');
    const mongoHost = process.env.MONGOHOST || envError('MONGOHOST not defined');
    const mongoPort = process.env.MONGOPORT || envError('MONGOPORT not defindd');

    return `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/?directConnection=true&authMechanism=DEFAULT`;
}

async function searchProxy(proxyName) {
    const connectionString = getConnectionString();

    console.log(`Connection string: ${connectionString}`);
    console.log(`Proxy name: ${proxyName}`);

    const connection = new MongoClient(connectionString);
    await connection.connect();

    const collection = connection.db(PROXY_DB).collection(PROXY_COLLECTION);
    const resp = await collection.findOne({name: proxyName});

    await connection.close();

    return resp;
}

function getPodData(podName, podIp, vpnClientIp) {

    return {
        apiVersion: 'v1',
        kind: 'Pod',
        metadata: {
            generateName: podName,
            labels: {
                app: 'proxy',
            },
        },
        spec: {
            containers: [
                {
                    name: 'vpnclient',
                    image: 'skamirik/openvpn-client:latest',
                    securityContext: {
                        capabilities: {
                            add: [ 'NET_ADMIN' ],
                        }
                    },
                    volumeMounts: [
                        {
                            name: 'tun-device',
                            mountPath: '/dev/net/tun',
                            readOnly: true
                        },
                        {
                            name: 'vpn-client-config',
                            mountPath: '/etc/openvpn/',
                        }
                    ],
                    env: [
                        {
                            name: 'VPN_SERVER_HOST',
                            value: podIp,
                        },
                        {
                            name: 'VPN_SERVER_PORT',
                            value: '1194',
                        }
                    ]
                },
                {
                    name: 'tinyproxy',
                    image: 'skamirik/tinyproxy:latest',

                    ports: [
                        {
                            name: 'proxy',
                            containerPort: 8080,
                        }
                    ],
                    env: [
                        {
                            name: 'LISTEN_PORT',
                            value: '8080'
                        },
                        {
                            name: 'UPSTREAM_HOST',
                            value: vpnClientIp,
                        },
                        {
                            name: 'UPSTREAM_PORT',
                            value: '1080'
                        }
                    ]
                },
            ],
            volumes: [
                {
                    name: 'tun-device',
                    hostPath: {
                        path: '/dev/net/tun',
                    }
                },
                {
                    name: 'vpn-client-config',
                    configMap: {
                        name: 'vpn-client',
                    }
                }
            ]
        }
    }
}

async function startProxy(vpnConfigName, namespace, apiserver, podName, podIp, vpnClientIp, apiToken) {
    const options = {
        url: `${apiserver}/api/v1/namespaces/${namespace}/pods`,
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiToken}` },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        data: getPodData(podName, podIp, vpnClientIp),
    };

    const resp = await axios(options);

    console.log(resp.data);
}

async function createRedisRecord(vpnConfigName, vpnClientIp, podIp) {
    const redisHost = process.env.REDIS_HOST || envError('REDIS_HOST not defined');
    const redisPort = process.env.REDIS_PORT || envError('REDIS_PORT not defined');
    const redisPass = process.env.REDIS_PASS || envError('REDIS_PASS not defined');
    const redisDb = process.env.REDIS_DB || envError('REDIS_DB not defined');

    const redis = redisTools.getRedisClient(redisHost, redisPort, redisPass, redisDb);
    const proxyNodeKey = redisTools.getProxyNodeKey(vpnConfigName);

    const nodeDetails = {
        name: vpnConfigName,
        localIp: vpnClientIp,
        status: 'connecting',
        httpSessions: 0,
        publicIp: '',
        uptime: '',
    };

    await redis.hset(proxyNodeKey, nodeDetails);
    await redis.disconnect();
}


(async function processProxy() {
    const namespace = process.env.NAMESPACE || envError('NAMESPACE not defined');
    const apiserver = process.env.APISERVER || envError('APISERVER not defined');
    const podName = process.env.POD_NAME || envError('POD_NAME not defined');
    const podIp = process.env.POD_IP || envError('POD_IP not defined');
    const apiToken = process.env.TOKEN || envError('TOKEN not defined');

    const vpnClientIp = process.env.VPN_CLIENT_IP || envError('VPN_CLIENT_IP not defined');
    const vpnConfigName = process.env.VPN_CONFIG_NAME || envError('VPN_CONFIG_NAME not defined');

    if (await searchProxy(vpnConfigName, namespace, apiserver)) {
        console.log(`Start proxy container for: ${vpnConfigName}`);
        try {
            await startProxy(vpnConfigName, namespace, apiserver, podName, podIp, vpnClientIp, apiToken);
            await createRedisRecord(vpnConfigName, vpnClientIp);

        } catch(error) {
            console.error(`Cannot start proxy: ${error}`);
        }

    } else {
        console.log(`Skip proxy container for: ${vpnConfigName}`);
    }

})();
