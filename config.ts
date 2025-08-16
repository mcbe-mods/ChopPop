export interface IConfig {
  name: string
  version: `${number}.${number}.${number}${string}`
  support_version: [number, number, number]
}

export default {
  name: 'Chop-Pop',
  version: '1.0.1',
  support_version: [1, 21, 0]
} as IConfig
