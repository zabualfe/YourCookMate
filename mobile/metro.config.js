const { getDefaultConfig } = require('expo/metro-config')

const config = getDefaultConfig(__dirname)

// Listen on all interfaces so the iOS simulator can reach Metro via 127.0.0.1 or LAN IP.
config.server = {
  ...config.server,
  host: '0.0.0.0',
}

module.exports = config
