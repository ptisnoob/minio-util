<template>
  <div :class="{ 'file-item': true, norename: !rename }">
    <div class="file file-item-object" v-if="n.name" @contextmenu.prevent="fileRightMenu">
      <el-image class="img" v-if="n.imgPath" :src="n.imgPath" lazy :preview-src-list="imgPreviewList">
        <div slot="error" class="image-slot">
          <i class="el-icon-picture-outline"></i>
        </div>
      </el-image>
      <svg-icon v-else :icon-class="n.sub.length > 6 ? 'unknown' : n.sub" />
      <span v-if="!rename" class="file-name">
        <a href="javascript:void(0)" :title="n.name"> {{ n.name }}</a>
      </span>
      <el-input v-else v-model="newName" autofocus placeholder="输入新的名称" @blur="onBlur" ref="renameInput"></el-input>
    </div>
    <div
      class="menu file-item-object"
      v-else-if="n.prefix"
      @click="showMenu"
      @click.right="rightClickMenu = n"
      @contextmenu.prevent="menuRightMenu"
    >
      <svg-icon icon-class="folder" />
      <span class="file-name" v-if="!n.newMenu">
        <a href="javascript:void(0)" :title="n.prefix"> {{ n.prefix }}</a></span
      >
      <el-input v-else v-model="n.prefix" autofocus placeholder="输入新的名称" @blur="n.newMenu = false"></el-input>
    </div>
    <div class="mask" @click="selItem"></div>
  </div>
</template>
<script>
export default {
  props: {
    n: {
      type: Object,
      require: true
    },
    minioClient: {
      type: Object,
      require: true
    },
    imgPreviewList: {
      type: Array,
      default: () => []
    },
    host: {
      type: String,
      default: ''
    },
    path: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      rename: false,
      newName: ''
    }
  },
  //   computed: {
  //     sub() {
  //       const split = this.n.name.split('.')
  //       return split[split.length - 1]
  //     }
  //   },
  methods: {
    fileRightMenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: () => {
              console.log('点击删除')
              this.$emit('delFile')
            }
          },
          {
            label: '下载',
            onClick: () => {
              const el = document.createElement('a')
              el.style.display = 'none'
              el.setAttribute('target', '_blank')
              const url = `${this.host}/${this.path}${this.n.name}`
              console.log('path=' + url)
              el.setAttribute('download', this.n.name)
              el.href = url
              document.body.appendChild(el)
              el.click()
              document.body.removeChild(el)
            }
          },
          {
            label: '复制',
            onClick: () => {
              const split = this.path.split('/')
              this.$store.dispatch('app/toggleClipboard', [
                { item: this.n, bucket: split[0], path: split.slice(1).join('/'), client: this.minioClient }
              ])
              this.$message.success('复制成功')
            }
          },
          {
            label: '复制访问路径',
            onClick: () => {
              var aux = document.createElement('input')
              aux.setAttribute('value', `${this.host}/${this.path}${this.n.name}`)
              document.body.appendChild(aux)
              aux.select()
              document.execCommand('copy')
              document.body.removeChild(aux)
              this.$message.success('复制成功!')
            }
          },
          {
            label: '重命名',
            onClick: () => {
              this.newName = this.n.name
              this.rename = true
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    menuRightMenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: () => {
              this.$emit('delMenu')
            }
          },
          {
            label: '复制',
            onClick: () => {
              const split = this.path.split('/')
              this.$store.dispatch('app/toggleClipboard', [
                { item: this.n, bucket: split[0], path: split.slice(1).join('/'), client: this.minioClient, menu: true }
              ])
              this.$message.success('复制成功')
            }
          },
          {
            label: '下载',
            onClick: () => {
              this.$emit('downLoadMenu')
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    showMenu() {
      if (!this.n.newMenu) this.$emit('showMenu')
      else this.$message.warning('请先命名该文件夹')
    },
    selItem() {
      this.$emit('selItem')
    },
    onBlur() {
      this.$emit('rename', { old: this.n.name, newName: this.newName })
      this.rename = false
    }
  }
}
</script>
<style scoped>
.file-item .mask {
  position: absolute;
  background: #cecece70;
  width: 100%;
  height: 100%;
  left: -200%;
  top: -200%;
  z-index: 10;
  transition: all 0.2s ease-in-out;
  cursor: pointer;
  /* border: 1px solid red; */
}
.file-item {
  width: 10%;
  height: 100px;
  margin: 10px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s ease-in-out;
}

.file-item-object {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  height: 100%;
  font-weight: 600;
  cursor: pointer;
  overflow: hidden;
}
.file-item-object > .file-name {
  display: inline-block;
  width: 95%;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.file-item-object > .file-name > a {
  text-decoration: none;
  color: unset;
}
.file-item-object i {
  font-size: 80px;
}
.file-item .svg-icon {
  width: 80px;
  height: 80px;
}
.file-item > .file > .el-image {
  max-width: 80%;
  flex-shrink: 0;
  height: 80px;
  transition: all 0.3s ease-in-out;
}
.norename.file-item > .file:hover > .img {
  max-width: 120%;
  width: 120%;
  height: 100%;
}
.file-item > .file > i {
  color: #869583;
}
.file-item > .menu > i {
  color: #fce832;
}
.show-select .mask {
  left: 0;
  top: 0;
}
.file-item.is-select {
  background: #4fa8f0;
  color: #fff;
}
</style>
<style lang="css">
.file-item .el-input__inner {
  height: 20px;
  line-height: 20px;
}
</style>
