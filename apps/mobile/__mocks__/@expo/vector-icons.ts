import React from 'react'
import { Text } from 'react-native'

const Ionicons = ({ name, size, color, ...rest }: Record<string, unknown>) =>
  React.createElement(Text, { ...rest, testID: `icon-${name}` })

Ionicons.glyphMap = {}

module.exports = { Ionicons }