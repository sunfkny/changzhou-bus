<script setup lang="ts">
import { ref, computed, nextTick, onMounted, useTemplateRef } from "vue";
import { useRouter } from "vue-router";
import { useQuery } from "@tanstack/vue-query";
import { refDebounced } from "@vueuse/core";
import { getLineList } from "../api/bus";
import type { LineInfo } from "../types/bus";
import { useFavorites } from "../composables/useFavorites";

const router = useRouter();
const { favoriteLines, removeFavorite, openFavorite } = useFavorites();

const searchKeyword = ref("");
const debouncedKeyword = refDebounced(searchKeyword, 300);
const searchInput = useTemplateRef("searchInput");

onMounted(() => {
  nextTick(() => searchInput.value?.focus());
});

const searchQuery = useQuery({
  queryKey: computed(() => ["search", debouncedKeyword.value]),
  queryFn: () => getLineList({ Line_Name: debouncedKeyword.value }),
  enabled: computed(() => debouncedKeyword.value.trim().length > 0),
});

const searchResults = computed(() => searchQuery.data.value ?? []);

const showResults = computed(() => searchKeyword.value.trim().length > 0);

function selectLine(line: LineInfo) {
  router.push({
    name: "map",
    params: { lineId: line.Line_Id, lineType: line.Line_Type },
  });
}

async function onOpenFavorite(line: Parameters<typeof openFavorite>[0]) {
  const lineInfo = await openFavorite(line);
  if (lineInfo) {
    router.push({
      name: "map",
      params: { lineId: lineInfo.Line_Id, lineType: lineInfo.Line_Type },
    });
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col h-full">
    <!-- 固定顶部 -->
    <div class="sticky top-0 z-10 bg-gray-50">
      <header class="bg-white px-4 pt-8 pb-4">
        <h1 class="text-2xl font-bold text-gray-800 mb-4">常州公交</h1>
        <div class="relative">
          <input
            ref="searchInput"
            v-model="searchKeyword"
            class="w-full h-11 px-4 pr-10 bg-gray-100 rounded-full text-sm outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="搜索线路号"
          />
          <button
            v-if="searchKeyword"
            class="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full active:bg-gray-200"
            @click="searchKeyword = ''"
          >
            <svg
              class="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </header>
    </div>

    <!-- 可滚动内容 -->
    <div class="flex-1 overflow-y-auto">
      <!-- 搜索结果 -->
      <div v-if="showResults">
        <div
          v-for="line in searchResults"
          :key="`${line.Line_Id}-${line.Line_Type}`"
          class="p-4 border-b border-gray-50 active:bg-gray-50"
          @click="selectLine(line)"
        >
          <div class="flex items-center justify-between">
            <div class="font-medium text-gray-800">{{ line.Line_Name }}</div>
            <div class="text-xs text-gray-400">¥{{ line.Ticket }}</div>
          </div>
          <div class="text-sm text-gray-500 mt-1">
            {{ line.Start_Station_Name }} → {{ line.End_Station_Name }}
          </div>
          <div class="text-xs text-gray-400 mt-1">
            {{ line.Start_Time }} - {{ line.End_Time }}
          </div>
        </div>
        <div
          v-if="searchResults.length === 0"
          class="p-8 text-center text-gray-400"
        >
          未找到相关线路
        </div>
      </div>

      <!-- 收藏线路 -->
      <div v-else class="p-4">
        <div class="text-sm font-medium text-gray-700 mb-3">收藏线路</div>
        <div
          v-if="favoriteLines.length === 0"
          class="text-center text-gray-400 py-8 text-sm"
        >
          暂无收藏，在线路详情页点击收藏
        </div>
        <div v-else class="space-y-2">
          <div
            v-for="line in favoriteLines"
            :key="`${line.lineId}-${line.lineType}`"
            class="flex items-center justify-between p-3 bg-gray-50 rounded-xl active:bg-gray-100"
            @click="onOpenFavorite(line)"
          >
            <div>
              <div class="font-medium text-gray-800">{{ line.lineName }}</div>
              <div class="text-xs text-gray-500">
                {{ line.startStation }} → {{ line.endStation }}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                class="p-1 active:bg-gray-200 rounded-full"
                @click.stop="removeFavorite(line)"
              >
                <svg
                  class="w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
