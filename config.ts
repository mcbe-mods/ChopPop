export interface IConfig {
  name: string
  version: `${number}.${number}.${number}${string}`
  min_support_version: [number, number, number]
  max_support_version: [number, number, number] | 'latest' | 'beta'
}

export default {
  name: 'Chop-Pop',
  version: '1.0.1',
  min_support_version: [1, 21, 80],
  max_support_version: 'latest'
} as IConfig
