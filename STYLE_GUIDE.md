# AI Hub Admin — 样式规范

> **阅读说明**：每次新开发页面或模块时，AI 和开发者都应先阅读本文档，确保所有模块样式与设计系统保持一致，避免视觉割裂。

---

## 一、设计理念

本系统面向 AI 大模型后端管理场景，设计风格参考主流 AI 平台（OpenAI Platform、Anthropic Console、AWS Bedrock）：

- **专业克制**：深色侧边栏 + 浅色内容区，科技感强而不花哨
- **信息密度适中**：卡片式布局，留白充足，关键信息突出
- **品牌一致**：以 Indigo-Purple 渐变为品牌主色，贯穿全局

---

## 二、颜色系统

### 品牌色 / Brand

| Token | 值 | 用途 |
|---|---|---|
| `--brand-primary` | `#6366f1` | 主操作按钮、激活状态、强调色 |
| `--brand-primary-dark` | `#4f46e5` | 主色 hover 深化 |
| `--brand-primary-light` | `#818cf8` | 次要强调、图标点缀 |
| `--brand-gradient` | `linear-gradient(135deg, #6366f1, #8b5cf6)` | Logo 图标、Avatar、发送按钮 |

### 功能色 / Semantic

| 颜色 | 十六进制 | 用途 |
|---|---|---|
| 成功绿 | `#10b981` | 状态 badge、成功提示 |
| 警告橙 | `#f59e0b` | 警告状态、用户管理图标 |
| 错误红 | `#ef4444` | 危险操作、错误图标 |
| 信息紫 | `#8b5cf6` | 请求量统计图标 |

### 中性色 / Neutral

| Token | 值 | 用途 |
|---|---|---|
| 文字主色 | `#111827` | 页面标题、重要数据 |
| 文字次色 | `#374151` | 普通正文、卡片标题 |
| 文字辅助 | `#6b7280` | 描述文字、占位文字 |
| 文字禁用 | `#9ca3af` | 禁用态、metadata |
| 边框颜色 | `#e5e7eb` | 卡片边框、分割线 |
| 浅边框 | `#f1f3f5` | 行分割、内部边框 |
| 页面背景 | `#f3f4f8` | main 内容区背景 |
| 卡片背景 | `#ffffff` | 所有白色卡片 |

### 侧边栏专用色

| 名称 | 值 | 用途 |
|---|---|---|
| 侧边栏背景 | `#111827` | el-aside 背景 |
| 菜单项文字 | `#9ca3af` | 非激活菜单文字 |
| 菜单项 hover | `rgba(255,255,255,0.06)` | 悬停背景 |
| 激活菜单背景 | `rgba(99,102,241,0.14)` | 当前选中菜单 |
| 激活菜单文字 | `#a5b4fc` | 当前选中菜单文字 |
| 激活左边框 | `3px solid #6366f1` | 激活菜单指示条 |
| 分割线 | `rgba(255,255,255,0.06)` | Logo/Footer 分割线 |

---

## 三、字体系统

### 字体族

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
```

### 字号层级

| 级别 | 字号 | 字重 | 用途 |
|---|---|---|---|
| 页面标题 | `20px` | `700` | `.page-title` |
| 卡片标题 | `15px` | `600` | `.section-title` |
| 正文 | `14px` | `400` | 普通内容、消息气泡 |
| 辅助信息 | `13px` | `400/500` | 表单标签、info 行 |
| 小字 | `12px` | `400` | 描述文字、stat-label |
| 极小字 | `11px` | `400/700` | 时间戳、badge、图标标注 |

---

## 四、间距系统

基础单位：`4px`

| 名称 | 值 | 场景 |
|---|---|---|
| xs | `4px` | 内联元素间距 |
| sm | `8px` | 列表项内间距 |
| md | `12–14px` | 气泡 padding、表单控件 |
| lg | `16–20px` | 卡片 padding、消息间距 |
| xl | `24px` | 页面 padding、section 间距 |
| 2xl | `28px` | Dashboard section gap |

---

## 五、圆角系统

| 名称 | 值 | 用途 |
|---|---|---|
| xs | `4px` | badge、tag |
| sm | `6px` | 消息气泡内部元素 |
| md | `8px` | 侧边栏 avatar、菜单 hover（未来）|
| lg | `10px` | action card、info card |
| xl | `12px` | stat card、消息气泡 |
| pill | `999px` | file chip、badge |

---

## 六、阴影系统

```css
--shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md:   0 4px 12px rgba(0, 0, 0, 0.08);
--shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.12);
--shadow-card: 0 1px 3px rgba(0, 0, 0, 0.06), 0 0 1px rgba(0, 0, 0, 0.04);
```

卡片默认使用 `--shadow-card`，hover 状态升级为 `--shadow-md`。

---

## 七、布局结构

### 全局布局（BasicLayout.vue）

```
┌────────────────────────────────────────────────────┐
│  el-aside (220px, bg:#111827)                      │
│  ┌─ Logo (60px, brand gradient icon)               │
│  ├─ el-scrollbar > el-menu (dark themed)           │
│  └─ sidebar-footer (user avatar + name)            │
├────────────────────────────────────────────────────┤
│  el-container                                      │
│  ┌─ el-header (56px, bg:#ffffff, shadow)           │
│  │   left: 页面标题   right: 运行状态              │
│  └─ el-main (bg:#f3f4f8, padding:24px)             │
│      └─ <router-view />                            │
└────────────────────────────────────────────────────┘
```

### Chat 布局（ChatLayout.vue）

```
┌─ chat-header (56px, 全宽, 独立 header) ────────────┐
│   left: 返回按钮   center: 标题   right: 用户名     │
├─ chat-body (flex, 占满剩余高度) ───────────────────┤
│  ┌─ chat-sidebar (280px, bg:#ffffff)               │
│  │   ┌─ app-section (42%, 应用列表)                │
│  │   └─ conversation-section (58%, 对话列表)       │
│  └─ chat-main (flex:1, bg:#f3f4f8)                 │
│      ┌─ chat-main-header (46px)                    │
│      ├─ message-panel (flex:1, padding:20px)       │
│      └─ input-panel (bg:#fff, padding:14px 20px)   │
└────────────────────────────────────────────────────┘
```

---

## 八、组件模式

### 统计卡片（Stat Card）

```html
<div class="stat-card">
  <div class="stat-icon stat-icon--primary"><!-- SVG --></div>
  <div class="stat-body">
    <div class="stat-label">指标名称</div>
    <div class="stat-value">数值</div>
    <div class="stat-trend">趋势说明</div>
  </div>
</div>
```

图标颜色系列：
- `--primary` → `#6366f1` (indigo)
- `--purple` → `#8b5cf6`
- `--green` → `#10b981`
- `--orange` → `#f59e0b`
- `--red` → `#ef4444`

### 快捷入口卡（Action Card）

使用 `el-card shadow="never"` + 自定义图标 + 标题 + 描述结构。
hover 时：`border-color: #6366f1`，`box-shadow` 带品牌色光晕，`transform: translateY(-1px)`。

### 消息气泡（Message Bubble）

- 用户消息：`background: linear-gradient(135deg, #6366f1, #7c3aed)`，白色文字
- AI 消息：`background: #ffffff`，`border: 1px solid #e5e7eb`，深色文字
- 气泡 `border-radius: 12px`，`padding: 12px 14px`
- 每条消息带 32px 圆角头像（AI: indigo 渐变，User: sky→indigo 渐变）

### Avatar（头像/图标）

```css
/* AI 头像 */
background: linear-gradient(135deg, #6366f1, #8b5cf6);
border-radius: 8px;
box-shadow: 0 2px 6px rgba(99, 102, 241, 0.3);

/* 用户头像 */
background: linear-gradient(135deg, #0ea5e9, #6366f1);
border-radius: 8px;
box-shadow: 0 2px 6px rgba(14, 165, 233, 0.3);
```

### Badge（状态徽标）

```html
<span class="badge badge--success">运行中</span>
```

```css
.badge {
  padding: 2px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 600;
}
.badge--success { background: rgba(16,185,129,0.1); color: #059669; }
.badge--warning { background: rgba(245,158,11,0.1); color: #d97706; }
.badge--danger  { background: rgba(239,68,68,0.1);  color: #dc2626; }
.badge--info    { background: rgba(99,102,241,0.1);  color: #4f46e5; }
```

---

## 九、交互规范

| 状态 | 效果 |
|---|---|
| hover（卡片） | `box-shadow` 升级，无背景色突变 |
| hover（列表项） | `background: #f3f4f8`，边框显现 |
| 激活（菜单） | 左侧 3px indigo 边框 + 浅紫背景 |
| hover（按钮-text） | `background: rgba(99,102,241,0.06)`，文字变 indigo |
| hover（主按钮） | `translateY(-1px)` + 加深阴影 |
| 过渡时长 | 默认 `0.18s ease`，卡片 hover `0.2s ease` |

---

## 十、新模块开发检查清单

开发新页面时，请对照以下清单：

- [ ] 页面背景使用 `#f3f4f8`（由 `el-main` 提供，无需重复设置）
- [ ] 卡片使用 `background: #ffffff`，`border-radius: 12px`，`--shadow-card`
- [ ] 主要操作按钮使用 `type="primary"`（系统已全局接入品牌渐变色）
- [ ] 图标色系使用上方「功能色」系列，不随意引入新颜色
- [ ] 文字颜色严格使用「中性色」系列的六档
- [ ] 任何 hover/active 交互都需要 `transition: all 0.18s ease`
- [ ] 列表类页面参考 Dashboard action-card 模式
- [ ] 数据展示类页面参考 Dashboard stat-card 模式
- [ ] 不在组件中 hardcode `--el-color-primary` 以外的 Element Plus token，优先使用本文档的色值

---

## 十一、Element Plus 覆盖规范

本项目在深色侧边栏中通过 `:deep()` 覆盖了 Element Plus 的 `el-menu` 样式。
新增对 Element Plus 组件的覆盖时：

1. 优先使用 CSS 变量（Element Plus 的 `--el-*` token）
2. 必须使用 `.layout-aside :deep(...)` 或组件根元素 `:deep(...)` 前缀，避免全局污染
3. 覆盖时注明用途注释

---

> 本文档随项目演进持续更新。新增模块完成后，如引入了新的设计 pattern，请同步更新本文档对应章节。
