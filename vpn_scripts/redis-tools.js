"use strict"

const Redis = require('ioredis');


function getRedisClient(host, port, password, db) {
    const redis = new Redis({ host, port, password, db });

    redis.on('connect', () => console.log('Redis connected'));
    redis.on('ready', () => console.log('Readis ready'));
    redis.on('error', (error) => console.log(`Redis error: ${error}`));
    redis.on('close', () => console.log('Redis closed'));

    return redis;
}

exports.getRedisClient = getRedisClient;
