"use strict"

const { MongoClient } = require('mongodb');
const axios = require('axios');
const https = require('https');

const redisTools = require('./redis-tools');
const envTools = require('./env-tools');

const PROXY_DB = 'proxyPool';
const PROXY_COLLECTION = 'proxy';
const HEALTH_CONTAINER_TAG = process.env.HEALTH_CONTAINER_TAG || envTools.envError('HEALTH_CONTAINER_TAG not defined');


function getMongoConnectionString() {
    const mongoUser = process.env.MONGOUSER || envTools.envError('MONGOUSER not defined');
    const mongoPass = process.env.MONGOPASS || envTools.envError('MONGOPASS not defined');
    const mongoHost = process.env.MONGOHOST || envTools.envError('MONGOHOST not defined');
    const mongoPort = process.env.MONGOPORT || envTools.envError('MONGOPORT not defindd');

    return `mongodb://${mongoUser}:${mongoPass}@${mongoHost}:${mongoPort}/?directConnection=true&authMechanism=DEFAULT`;
}

async function searchProxy(proxyName) {
    const connectionString = getMongoConnectionString();

    console.log(`Connection string: ${connectionString}`);
    console.log(`Proxy name: ${proxyName}`);

    const connection = new MongoClient(connectionString);
    await connection.connect();

    const collection = connection.db(PROXY_DB).collection(PROXY_COLLECTION);
    const resp = await collection.findOne({name: proxyName});

    await connection.close();

    return resp;
}

function getPodData(podName, vpnPodIp, vpnClientIp, vpnConfigName) {
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
			affinity: {
				nodeAffinity: {
					requiredDuringSchedulingIgnoredDuringExecution: {
						nodeSelectorTerms: [
							{
								matchExpressions: [
									{
										key: "provider",
										operator: "In",
										values: [ "digital-ocean" ]
									}
								]
							}
						]
					}
				}
			},
            containers: [
				{
					name: 'healtchcheck',
					image: `skamirik/proxy-healtch-check:${HEALTH_CONTAINER_TAG}`,
					imagePullPolicy: 'IfNotPresent',
					env: [
						{
                            name: 'HOST_TO_CHECK',
                            value: vpnClientIp,
                        },
                        {
                            name: 'PORT_TO_CHECK',
                            value: '1080',
                        },
						{
                            name: 'PORT_TO_LISTEN',
                            value: '8888',
						},
						{
							name: 'HEALTH_SOCKET_TIMEOUT',
							value: '2000',
						}
					],
					ports: [
						{
							name: 'healtch',
							containerPort: 8888,
						}
					]
				},
                {
                    name: 'vpnclient',
                    image: 'skamirik/openvpn-client:latest',
                    imagePullPolicy: 'IfNotPresent',
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
                            value: vpnPodIp,
                        },
                        {
                            name: 'VPN_SERVER_PORT',
                            value: '1194',
                        },
                        {
                            name: 'VPN_CONFIG_NAME',
                            value: vpnConfigName,
                        },
                    ]
                },
                {
                    name: 'tinyproxy',
                    image: 'skamirik/tinyproxy:1692807215',
                    imagePullPolicy: 'IfNotPresent',

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
        data: getPodData(podName, podIp, vpnClientIp, vpnConfigName),
    };

    const resp = await axios(options);

    console.log(resp.data);
}

async function createRedisRecord(redisHost, redisPort, redisPass, redisDb, vpnConfigName, vpnClientIp) {
    const redis = redisTools.getRedisClient(redisHost, redisPort, redisPass, redisDb);
    const proxyNodeKey = redisTools.getProxyNodeKey(vpnConfigName);

    const nodeDetails = {
        name: vpnConfigName,
        localIp: vpnClientIp,
        status: 'connecting',
        httpSessions: 0, publicIp: '',
        uptime: '',
    };

    await redis.hset(proxyNodeKey, nodeDetails);
    await redis.disconnect();
}


(async function processProxy() {
    const namespace = process.env.NAMESPACE || envTools.envError('NAMESPACE not defined');
    const apiserver = process.env.APISERVER || envTools.envError('APISERVER not defined');
    const podName = process.env.POD_NAME || envTools.envError('POD_NAME not defined');
    const vpnPodIp = process.env.POD_IP || envTools.envError('POD_IP not defined');
    const apiToken = process.env.TOKEN || envTools.envError('TOKEN not defined');

    const vpnClientIp = process.env.VPN_CLIENT_IP || envTools.envError('VPN_CLIENT_IP not defined');
    const vpnConfigName = process.env.VPN_CONFIG_NAME || envTools.envError('VPN_CONFIG_NAME not defined');

    const redisHost = process.env.REDIS_HOST || envTools.envError('REDIS_HOST not defined');
    const redisPort = process.env.REDIS_PORT || envTools.envError('REDIS_PORT not defined');
    const redisPass = process.env.REDIS_PASS || envTools.envError('REDIS_PASS not defined');
    const redisDb = process.env.REDIS_DB || envTools.envError('REDIS_DB not defined');

    if (await searchProxy(vpnConfigName, namespace, apiserver)) {
        console.log(`Start proxy container for: ${vpnConfigName}`);
        try {
            await startProxy(vpnConfigName, namespace, apiserver, podName, vpnPodIp, vpnClientIp, apiToken);
            await createRedisRecord(redisHost, redisPort, redisPass, redisDb, vpnConfigName, vpnClientIp);

        } catch(error) {
            console.error(`Cannot start proxy: ${error}`);
        }

    } else {
        console.log(`Skip proxy container for: ${vpnConfigName}`);
    }

})();
