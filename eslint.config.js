import pluginVue from 'eslint-plugin-vue'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'

export default [
  {
    files: ['src/**/*.{ts,vue}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        parser: tsparser,
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      vue: pluginVue,
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      ...pluginVue.configs['vue3-recommended'].rules,

      // 禁止 any
      '@typescript-eslint/no-explicit-any': 'error',

      // Vue
      'vue/multi-word-component-names': 'off',
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/prop-name-casing': 'off',
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
]
