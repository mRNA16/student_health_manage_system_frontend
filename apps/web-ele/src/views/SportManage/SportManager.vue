<script lang="ts">
import { defineComponent, onMounted, ref, watch } from 'vue';

import dayjs from 'dayjs';
import { ElMessage } from 'element-plus';

import {
  addRecord,
  deleteRecord,
  getCurrentUser,
  getRecordList,
  getSportList,
  updateRecord,
} from '../../api/sport';

export default defineComponent({
  name: 'SportManager',
  setup() {
    const sportList = ref();
    const metList = ref();
    const recordList = ref([]);
    const dialogVisible = ref(false);
    const user = ref<any>(null);
    const caloriesPreview = ref(0);
    const form = ref({
      id: 0,
      date: '',
      sport: 0,
      begin_time: new Date(),
      end_time: new Date(),
      calories: 0,
    });
    const fetchUser = async () => {
      try {
        // 获取当前用户信息
        const userRes = await getCurrentUser();
        user.value = userRes;
      } catch {
        ElMessage.error('获取数据失败');
      }
    };

    const fetchSportList = async () => {
      const res = await getSportList();
      sportList.value = Array.isArray(res)
        ? res.filter((item) => 'name' in item).map((item) => item.name)
        : [];
      metList.value = Array.isArray(res)
        ? res.filter((item) => 'met' in item).map((item) => item.met)
        : [];
    };

    const fetchRecordList = async () => {
      const res = await getRecordList();
      recordList.value = res || [];
    };

    const openAddDialog = () => {
      form.value = {
        id: 0,
        date: '',
        sport: 0,
        begin_time: new Date(1970, 0, 1, 0, 0, 0),
        end_time: new Date(1970, 0, 1, 0, 0, 0),
        calories: 0,
      };
      dialogVisible.value = true;
      fetchSportList();
    };

    const editRecord = (row: {
      begin_time: string;
      calories: number;
      date: string;
      end_time: string;
      id: number;
      sport: number;
    }) => {
      const dateStr = row.date;
      form.value = {
        id: row.id,
        date: row.date,
        sport: row.sport,
        begin_time: dayjs(
          `${dateStr} ${row.begin_time}`,
          'YYYY-MM-DD HH:mm:ss',
        ).toDate(),
        end_time: dayjs(
          `${dateStr} ${row.end_time}`,
          'YYYY-MM-DD HH:mm:ss',
        ).toDate(),
        calories: row.calories,
      };
      dialogVisible.value = true;
    };

    const submitForm = async () => {
      const payload = {
        id: form.value.id,
        date: dayjs(form.value.date).format('YYYY-MM-DD'),
        begin_time: dayjs(form.value.begin_time).format('HH:mm:ss'),
        end_time: dayjs(form.value.end_time).format('HH:mm:ss'),
        sport: form.value.sport,
      };
      await (form.value.id ? updateRecord(payload) : addRecord(payload));
      dialogVisible.value = false;
      fetchRecordList();
    };

    const deleteRecords = async (id: number) => {
      await deleteRecord(id);
      fetchRecordList();
    };

    const getCurrentMet = () => {
      const index = form.value.sport;
      if (Array.isArray(metList.value) && metList.value.length > index) {
        const sportItem = metList.value[index];
        return sportItem?.met || 1;
      }
      return 1;
    };

    const getUserWeight = () => user.value?.weight || 60;
    const getGenderFactor = () => (user.value?.gender === 'male' ? 3.5 : 3.1);
    const getDurationMinutes = () => {
      const start = form.value.begin_time;
      const end = form.value.end_time;
      let diff = (end.getTime() - start.getTime()) / 60_000;
      if (diff < 0) {
        diff += 1440;
      }
      return diff;
    };
    const updateCaloriesPreview = () => {
      const met = getCurrentMet();
      const weight = getUserWeight();
      const factor = getGenderFactor();
      const duration = getDurationMinutes();
      const cal = ((met * weight * factor) / 200) * duration;
      caloriesPreview.value = cal;
    };
    watch(
      () => [form.value.sport, form.value.begin_time, form.value.end_time],
      updateCaloriesPreview,
      { immediate: true },
    );

    onMounted(() => {
      fetchSportList();
      fetchRecordList();
      fetchUser();
    });

    return {
      sportList,
      recordList,
      dialogVisible,
      form,
      user,
      caloriesPreview,
      openAddDialog,
      editRecord,
      submitForm,
      deleteRecords,
    };
  },
});
</script>

<template>
  <div class="sport-manager">
    <el-card>
      <template #header>
        <div class="clearfix">
          <span>运动记录管理</span>
          <el-button style="float: right" type="primary" @click="openAddDialog">
            新增记录
          </el-button>
        </div>
      </template>
      <el-table v-if="sportList?.length" :data="recordList" style="width: 100%">
        <el-table-column prop="date" label="日期" width="120" />
        <el-table-column label="运动项目">
          <template #default="scope">
            {{ sportList[scope.row.sport] || '未知' }}
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="时长(小时)" width="120" />
        <el-table-column prop="calories" label="消耗卡路里(kCal)" width="120" />
        <el-table-column label="操作" width="180">
          <template #default="scope">
            <el-button size="default" @click="editRecord(scope.row)">
              编辑
            </el-button>
            <el-button
              size="default"
              type="danger"
              @click="deleteRecords(scope.row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog v-model="dialogVisible" title="运动记录">
      <el-form :model="form">
        <el-form-item label="日期">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="选择日期"
          />
        </el-form-item>
        <el-form-item label="运动项目">
          <el-select v-model="form.sport" placeholder="请选择运动项目">
            <el-option
              v-for="(item, index) in sportList"
              :key="index"
              :label="item"
              :value="index"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="开始时间">
          <el-time-picker
            v-model="form.begin_time"
            placeholder="开始时间"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-time-picker
            v-model="form.end_time"
            placeholder="结束时间"
            style="width: 120px"
          />
        </el-form-item>
        <el-form-item label="预计消耗卡路里">
          <div style="font-weight: bold; color: #409eff">
            {{ caloriesPreview }} kcal
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取 消</el-button>
          <el-button type="primary" @click="submitForm">确 定</el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.sport-manager {
  padding: 20px;
}
</style>
