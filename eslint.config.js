import antfu from '@antfu/eslint-config'

export default antfu({
  rules: {
    'no-console': 'off',
    'curly': ['error', 'multi-line', 'consistent'],
    'node/prefer-global/process': 'off',
    'style/max-statements-per-line': 'off',
  },
})
