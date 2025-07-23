<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';
import type { Recordable } from '@vben/types';

import { computed, h, ref } from 'vue';

import { AuthenticationRegister, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import dayjs from 'dayjs';

import { router } from '#/router';

import { registerApi } from '../../../api/core/auth';

defineOptions({ name: 'Register' });

const loading = ref(false);

const formSchema = computed((): VbenFormSchema[] => {
  return [
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.usernameTip'),
      },
      fieldName: 'username',
      label: $t('authentication.username'),
      rules: z.string().min(1, { message: $t('authentication.usernameTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        passwordStrength: true,
        placeholder: $t('authentication.passwordTip'),
      },
      fieldName: 'password',
      label: $t('authentication.password'),
      renderComponentContent() {
        return {
          strengthText: () => $t('authentication.passwordStrength'),
        };
      },
      rules: z.string().min(1, { message: $t('authentication.passwordTip') }),
    },
    {
      component: 'VbenInputPassword',
      componentProps: {
        placeholder: $t('authentication.confirmPassword'),
      },
      dependencies: {
        rules(values) {
          const { password } = values;
          return z
            .string({ required_error: $t('authentication.passwordTip') })
            .min(1, { message: $t('authentication.passwordTip') })
            .refine((value) => value === password, {
              message: $t('authentication.confirmPasswordTip'),
            });
        },
        triggerFields: ['password'],
      },
      fieldName: 'confirmPassword',
      label: $t('authentication.confirmPassword'),
    },
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.heightTip'),
        type: 'number',
      },
      fieldName: 'height',
      defaultValue: '',
      label: $t('authentication.heightTip'),
      rules: z.preprocess(
        (val) => (val === '' ? undefined : Number(val)),
        z.number().min(1, { message: $t('authentication.heightErrorTip') }),
      ),
    },
    // 体重
    {
      component: 'VbenInput',
      componentProps: {
        placeholder: $t('authentication.weightTip'),
        type: 'number',
      },
      fieldName: 'weight',
      defaultValue: '',
      label: $t('authentication.weightTip'),
      rules: z.preprocess(
        (val) => (val === '' ? undefined : Number(val)),
        z.number().min(1, { message: $t('authentication.weightErrorTip') }),
      ),
    },
    // 性别
    {
      component: 'VbenSelect',
      componentProps: {
        placeholder: $t('authentication.genderTip'),
        options: [
          { label: $t('authentication.male'), value: 'male' },
          { label: $t('authentication.female'), value: 'female' },
        ],
      },
      fieldName: 'gender',
      label: $t('authentication.genderTip'),
      rules: z.string().min(1, { message: $t('authentication.genderTip') }),
    },
    // 生日
    {
      component: 'DatePicker',
      componentProps: {
        placeholder: $t('authentication.birthdayTip'),
        type: 'date',
      },
      fieldName: 'birthday',
      label: $t('authentication.birthdayTip'),
      rules: z.date(),
    },
    {
      component: 'VbenCheckbox',
      fieldName: 'agreePolicy',
      renderComponentContent: () => ({
        default: () =>
          h('span', [
            $t('authentication.agree'),
            h(
              'a',
              {
                class: 'vben-link ml-1 ',
                href: '',
              },
              `${$t('authentication.privacyPolicy')} & ${$t('authentication.terms')}`,
            ),
          ]),
      }),
      rules: z.boolean().refine((value) => !!value, {
        message: $t('authentication.agreeTip'),
      }),
    },
  ];
});

function handleSubmit(value: Recordable<any>) {
  const data = {
    username: value.username,
    password: value.password,
    profile: {
      height: Number(value.height),
      weight: Number(value.weight),
      gender: value.gender,
      birthday: value.birthday
        ? dayjs(value.birthday).format('YYYY-MM-DD')
        : '',
      realName: value.username,
      roles: ['User'],
    },
  };
  try {
    registerApi(data);
    router.push('/auth/login');
  } catch {
    // 处理注册失败，显示后端返回的错误信息
  }
}
</script>

<template>
  <AuthenticationRegister
    :form-schema="formSchema"
    :loading="loading"
    @submit="handleSubmit"
  />
</template>
