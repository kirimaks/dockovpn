"use strict"

const { MongoClient } = require('mongodb');

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

    const connection = new MongoClient(connectionString);
    await connection.connect();

    const collection = connection.db(PROXY_DB).collection(PROXY_COLLECTION);
    const resp = await collection.findOne({name: proxyName});

    await connection.close();

    return resp;
}

(async function processProxy() {
    const clientName = process.env.VPN_CONFIG_NAME || envError('VPN_CONFIG_NAME not defined');

    if (await searchProxy(clientName)) {
        console.log(`Start proxy container for: ${clientName}`);

    } else {
        console.log(`Skip proxy container for: ${clientName}`);
    }

})();
