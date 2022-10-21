<template>
  <el-form :model="conditionForm" label-width="auto">
    <el-form-item label="文件名包含关键字：">
      <el-tag :key="tag" v-for="tag in conditionForm.key" closable :disable-transitions="false" @close="handleClose(tag, false)">
        {{ tag }}
      </el-tag>
      <el-input
        class="input-new-tag"
        v-if="inputVisible"
        v-model="inputValue"
        ref="saveTagInput"
        size="small"
        @keyup.enter.native="handleInputConfirm(false)"
        @blur="handleInputConfirm(false)"
      >
      </el-input>
      <el-button v-else class="button-new-tag" size="small" @click="showInput">+ 关键词</el-button>
    </el-form-item>
    <el-form-item label="文件名不包含关键字：">
      <el-tag :key="tag" v-for="tag in conditionForm.noKey" closable :disable-transitions="false" @close="handleClose(tag, true)">
        {{ tag }}
      </el-tag>
      <el-input
        class="input-new-tag"
        v-if="inputVisible2"
        v-model="inputValue"
        ref="saveTagInputNokey"
        size="small"
        @keyup.enter.native="handleInputConfirm(true)"
        @blur="handleInputConfirm(true)"
      >
      </el-input>
      <el-button v-else class="button-new-tag" size="small" @click="showInput2">+ 关键词</el-button>
    </el-form-item>
    <el-form-item label="包含关键字条件">
      <el-switch v-model="conditionForm.keyAnd" active-text="与" inactive-text="或"></el-switch>
    </el-form-item>
    <!-- <el-form-item label="不包含关键字条件">
      <el-switch v-model="conditionForm.noKeyAnd" active-text="与" inactive-text="或"></el-switch>
    </el-form-item> -->
    <el-form-item label="覆盖同名项：">
      <el-switch v-model="conditionForm.cover"></el-switch>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="$emit('back')">返回</el-button>
    </el-form-item>
  </el-form>
</template>
<script>
export default {
  name: 'conditionForm',
  props:{
    conditionForm:{
        type: Object,
        required:true
    }
  },
  data() {
    return {
      inputVisible: false,
      inputValue: '',
      inputVisible2: false,
      inputValue2: ''
    }
  },
  methods: {
    handleClose(tag, isNokey) {
      console.log(isNokey)
      const item = isNokey ? this.conditionForm.noKey : this.conditionForm.key
      item.splice(item.indexOf(tag), 1)
    },
    showInput() {
      this.inputVisible = true
      this.$nextTick(() => {
        this.$refs.saveTagInput.$refs.input.focus()
      })
    },
    showInput2() {
      this.inputVisible2 = true
      this.$nextTick(() => {
        this.$refs.saveTagInputNokey.$refs.input.focus()
      })
    },
    handleInputConfirm(isNokey) {
      const item = isNokey ? this.conditionForm.noKey : this.conditionForm.key
      let inputValue = this.inputValue
      if (inputValue) {
        item.push(inputValue)
      }
      this.inputVisible = false
      this.inputVisible2 = false
      this.inputValue = ''
      this.inputValue2 = ''
    }
  }
}
</script>
<style>
.el-tag + .el-tag {
  margin-left: 10px;
}
.button-new-tag {
  margin-left: 10px;
  height: 32px;
  line-height: 30px;
  padding-top: 0;
  padding-bottom: 0;
}
.input-new-tag {
  width: 90px;
  margin-left: 10px;
  vertical-align: bottom;
}
</style>
