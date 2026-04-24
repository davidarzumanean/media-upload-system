const React = require('react');
const { Text } = require('react-native');

const Ionicons = ({ name, ...rest }) =>
  React.createElement(Text, { ...rest, testID: `icon-${name}` });

Ionicons.glyphMap = {};

module.exports = { Ionicons };