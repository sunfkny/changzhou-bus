<script setup lang="ts">
import { DrawerContent, DrawerOverlay, DrawerPortal } from "vaul-vue";
import { cn } from "@/lib/utils";

const props = defineProps<{
  class?: string;
}>();
</script>

<template>
  <DrawerPortal>
    <DrawerOverlay class="fixed inset-0 z-50 bg-black/80" />
    <DrawerContent
      :class="
        cn(
          'fixed inset-x-0 bottom-0 z-50 mt-24 flex flex-col rounded-t-[10px] border bg-white',
          props.class,
        )
      "
    >
      <div class="mx-auto mt-3 h-1 w-10 rounded-full bg-gray-300" />
      <slot />
    </DrawerContent>
  </DrawerPortal>
</template>
