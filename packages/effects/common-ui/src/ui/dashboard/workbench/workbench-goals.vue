<script setup lang="ts">
import { ref, watch } from 'vue';

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@vben-core/shadcn-ui';

interface Goals {
  burn: number;
  intake: number;
  sleep: number;
}
interface Props {
  title?: string;
  totals?: Goals;
  goals?: Goals;
  percents?: Goals;
  editable?: boolean;
}

defineOptions({ name: 'WorkbenchGoals' });

const props = withDefaults(defineProps<Props>(), {
  title: '我的健康目标进度',
  totals: () => ({ burn: 0, intake: 0, sleep: 0 }),
  goals: () => ({ burn: 500, intake: 2000, sleep: 8 }),
  percents: () => ({ burn: 0, intake: 0, sleep: 0 }),
  editable: true,
});

const emit = defineEmits<{
  (e: 'save', value: Goals): void;
  (e: 'cancel'): void;
}>();

const isEditing = ref(false);
const localGoals = ref<Goals>({ ...props.goals });

watch(
  () => props.goals,
  (g) => {
    localGoals.value = { ...(g || { burn: 0, intake: 0, sleep: 0 }) };
  },
  { deep: true },
);

function onEdit() {
  isEditing.value = true;
}
function onCancel() {
  isEditing.value = false;
  localGoals.value = { ...props.goals };
  emit('cancel');
}
function onSave() {
  emit('save', { ...localGoals.value });
  isEditing.value = false;
}
</script>

<template>
  <Card>
    <CardHeader class="flex items-center justify-between py-4">
      <CardTitle class="text-lg">{{ title }}</CardTitle>
      <div v-if="editable" class="space-x-2">
        <Button v-if="!isEditing" size="sm" variant="outline" @click="onEdit">
          编辑
        </Button>
        <template v-else>
          <Button size="sm" variant="secondary" @click="onCancel">取消</Button>
          <Button size="sm" @click="onSave">保存</Button>
        </template>
      </div>
    </CardHeader>
    <CardContent class="space-y-4 p-5 pt-0">
      <div>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span>运动消耗</span>
          <span v-if="!isEditing">{{ totals.burn }} / {{ goals.burn }} 千卡 ({{
              percents.burn
            }}%)</span>
          <span v-else class="flex items-center gap-2">
            目标
            <input
              v-model.number="localGoals.burn"
              type="number"
              class="w-24 rounded border px-2 py-1 text-right"
            />
            千卡
          </span>
        </div>
        <div class="h-2 w-full rounded bg-gray-200">
          <div
            class="h-2 rounded bg-green-500"
            :style="{ width: `${percents.burn}%` }"
          ></div>
        </div>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span>摄入卡路里</span>
          <span v-if="!isEditing">{{ totals.intake }} / {{ goals.intake }} 千卡 ({{
              percents.intake
            }}%)</span>
          <span v-else class="flex items-center gap-2">
            目标
            <input
              v-model.number="localGoals.intake"
              type="number"
              class="w-24 rounded border px-2 py-1 text-right"
            />
            千卡
          </span>
        </div>
        <div class="h-2 w-full rounded bg-gray-200">
          <div
            class="h-2 rounded bg-blue-500"
            :style="{ width: `${percents.intake}%` }"
          ></div>
        </div>
      </div>

      <div>
        <div class="mb-1 flex items-center justify-between text-sm">
          <span>睡眠时长</span>
          <span v-if="!isEditing">{{ totals.sleep }} / {{ goals.sleep }} 小时 ({{
              percents.sleep
            }}%)</span>
          <span v-else class="flex items-center gap-2">
            目标
            <input
              v-model.number="localGoals.sleep"
              type="number"
              step="0.5"
              class="w-24 rounded border px-2 py-1 text-right"
            />
            小时
          </span>
        </div>
        <div class="h-2 w-full rounded bg-gray-200">
          <div
            class="h-2 rounded bg-purple-500"
            :style="{ width: `${percents.sleep}%` }"
          ></div>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
