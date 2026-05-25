<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Close, Plus } from '@element-plus/icons-vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    size?: number
  }>(),
  {
    size: 80
  }
)

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const processing = ref(false)

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_ORIGINAL_SIZE = 5 * 1024 * 1024
const MAX_OUTPUT_SIZE = 10 * 1024
const TARGET_SIZE = 128
const QUALITY_LEVELS = [0.85, 0.7, 0.6]

function trigger() {
  if (processing.value) return
  fileInput.value?.click()
}

function handleRemove() {
  emit('update:modelValue', '')
}

function estimateBytes(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
  return Math.floor(base64.length * 0.75)
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('图片解析失败'))
    image.src = dataUrl
  })
}

function canvasToDataUrl(canvas: HTMLCanvasElement, quality: number): string {
  return canvas.toDataURL('image/webp', quality)
}

async function processImage(file: File): Promise<string> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error('仅支持 JPG、PNG、WEBP 格式')
  }
  if (file.size > MAX_ORIGINAL_SIZE) {
    throw new Error('图片大小不能超过 5MB')
  }

  const dataUrl = await readAsDataUrl(file)
  const image = await loadImage(dataUrl)

  const srcSize = Math.min(image.width, image.height)
  if (!srcSize) {
    throw new Error('图片尺寸无效')
  }

  const srcX = Math.floor((image.width - srcSize) / 2)
  const srcY = Math.floor((image.height - srcSize) / 2)

  const canvas = document.createElement('canvas')
  canvas.width = TARGET_SIZE
  canvas.height = TARGET_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('浏览器不支持 Canvas')
  }

  ctx.clearRect(0, 0, TARGET_SIZE, TARGET_SIZE)
  ctx.drawImage(image, srcX, srcY, srcSize, srcSize, 0, 0, TARGET_SIZE, TARGET_SIZE)

  for (const quality of QUALITY_LEVELS) {
    const nextDataUrl = canvasToDataUrl(canvas, quality)
    if (estimateBytes(nextDataUrl) <= MAX_OUTPUT_SIZE) {
      return nextDataUrl
    }
  }

  throw new Error('头像压缩后仍超过 10KB，请换一张更简单的图片')
}

async function handleFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  processing.value = true
  try {
    const nextImage = await processImage(file)
    emit('update:modelValue', nextImage)
  } catch (error: any) {
    ElMessage.error(error?.message || '头像处理失败')
  } finally {
    processing.value = false
  }
}
</script>

<template>
  <div class="icon-uploader" :style="{ width: `${props.size}px`, height: `${props.size}px` }">
    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      @change="handleFile"
    />
    <div v-if="props.modelValue" class="preview" @click="trigger">
      <img :src="props.modelValue" alt="icon" />
      <span class="remove" @click.stop="handleRemove">
        <el-icon><Close /></el-icon>
      </span>
    </div>
    <div v-else class="placeholder" @click="trigger">
      <el-icon :size="24"><Plus /></el-icon>
      <span>上传头像</span>
    </div>
  </div>
</template>

<style scoped lang="less">
.icon-uploader {
  position: relative;
  overflow: hidden;
  background: var(--el-fill-color-blank);
  border: 1px dashed var(--el-border-color);
  border-radius: 12px;
  transition: border-color 0.2s ease;
}

.icon-uploader:hover {
  cursor: pointer;
  border-color: var(--el-color-primary);
}

.preview,
.placeholder {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.placeholder {
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.remove {
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  width: 20px;
  height: 20px;
  color: #fff;
  background: rgb(0 0 0 / 55%);
  border-radius: 50%;
  align-items: center;
  justify-content: center;
}
</style>
