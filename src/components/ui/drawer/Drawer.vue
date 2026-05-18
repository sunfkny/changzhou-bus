<!-- eslint-disable vue/multi-word-component-names -->
<script setup lang="ts">
import { DrawerRoot } from "vaul-vue";

const props = defineProps<{
  open?: boolean;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();
</script>

<template>
  <DrawerRoot :open="props.open" @update:open="emit('update:open', $event)">
    <slot />
  </DrawerRoot>
</template>
