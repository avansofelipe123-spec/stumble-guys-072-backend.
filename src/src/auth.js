
const crypto = require("crypto");

function generateAccountToken() {
    return crypto.randomBytes(32).toString("hex");
}

function hashToken(token) {
    return crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");
}

function validateToken(token) {
    return (
        typeof token === "string" &&
        /^[a-f0-9]{64}$/i.test(token)
    );
}

module.exports = {
    generateAccountToken,
    hashToken,
    validateToken
};
