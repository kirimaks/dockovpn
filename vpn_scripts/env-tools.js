"use strict"

function envError(errorText) {
    throw new Error(errorText);
}

exports.envError = envError;
