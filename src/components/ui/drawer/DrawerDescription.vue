<script setup lang="ts">
import { DrawerDescription } from 'vaul-vue'
import { cn } from '@/lib/utils'

const props = defineProps<{
  class?: string
}>()
</script>

<template>
  <DrawerDescription :class="cn('text-sm text-gray-500', props.class)">
    <slot />
  </DrawerDescription>
</template>
