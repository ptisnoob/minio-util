<template>
  <div
    class="client-box"
    v-loading="pageLoading"
    element-loading-text="拼命加载中"
    element-loading-spinner="el-icon-loading"
    element-loading-background="rgba(0, 0, 0, 0.8)"
  >
    <div class="bucket-box">
      <div
        :class="['bucket-item', { 'active-bucket': activeBucket === n.name }]"
        v-for="(n, index) in buckets"
        :key="index"
        @click="selBucket(n.name)"
        @click.right="rightClickBucket = n"
        @contextmenu.prevent="onContextmenu"
      >
        <span class="bucket-item-title"> {{ n.name }}</span>
      </div>
      <div class="bucket-item" @click="createBucketDialogVisible = true">
        <span class="bucket-item-title color-primary"> 新增Bucket</span>
      </div>
    </div>
    <div class="tool-box">
      <el-form inline :model="searchForm" label-width="auto">
        <el-form-item label="关键字">
          <el-input v-model="searchForm.key" placeholder="请输入关键字进行搜索" @input="search"></el-input>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="resetSearch">重置搜索</el-button>
          <el-button type="primary" @click="refreshFiles">刷新数据</el-button>
        </el-form-item>
        <el-form-item style="float: right" v-show="currentPath !== ''">
          <el-button type="primary" @click="back">返回</el-button>
        </el-form-item>
      </el-form>
    </div>
    <div class="current-path">
      当前路径：<span> {{ activeBucket }}</span> / <span>{{ currentPath }}</span>
    </div>
    <div class="file-box">
      <el-empty v-if="bucketFiles.length === 0">
        <el-button type="primary">上传文件</el-button>
      </el-empty>
      <div v-else class="file-item" v-for="(n, index) in bucketFiles" :key="index">
        <div class="file file-item-object" v-if="n.name" @click.right="rightClickFile = n" @contextmenu.prevent="fileRightMenu">
          <el-image v-if="n.imgPath" :src="n.imgPath" lazy :preview-src-list="imgPreviewList">
            <div slot="error" class="image-slot">
              <i class="el-icon-picture-outline"></i>
            </div>
          </el-image>
          <i v-else class="el-icon-document"></i>
          <span class="file-name">
            <a href="javascript:void(0)" :title="n.name"> {{ n.name }}</a>
          </span>
        </div>
        <div
          class="menu file-item-object"
          v-else-if="n.prefix"
          @click="showMenu(n.prefix)"
          @click.right="rightClickMenu = n"
          @contextmenu.prevent="menuRightMenu"
        >
          <i class="el-icon-folder-opened"></i>
          <span class="file-name">
            <a href="javascript:void(0)" :title="n.prefix"> {{ n.prefix }}</a></span
          >
        </div>
      </div>
    </div>

    <el-dialog title="新建Bucket" :visible.sync="createBucketDialogVisible">
      <el-form :model="createForm">
        <el-form-item label="Bucket名称">
          <el-input v-model="createForm.name"></el-input>
        </el-form-item>
      </el-form>
      <div slot="footer">
        <el-button @click="createBucketDialogVisible = false">取 消</el-button>
        <el-button type="primary" @click="createBucket">确 定</el-button>
      </div>
    </el-dialog>
  </div>
</template>
<script>
const Minio = require('minio')
const imgPrefix = ['png', 'jpg', 'gif', 'jpeg', 'jfif']
export default {
  name: 'minioClient',
  props: {
    option: {
      type: Object,
      required: true
    }
  },
  data() {
    return {
      searchForm: {
        key: ''
      },
      pageLoading: false,
      connectFailed: true,
      minioClient: null,
      buckets: [],
      activeBucket: '',
      bucketFiles: [],
      currentPath: '',
      imgPreviewList: [],
      rightClickFile: null,
      rightClickBucket: null,
      rightClickMenu: null,
      createBucketDialogVisible: false,
      createForm: {
        name: ''
      },
      files: []
    }
  },
  methods: {
    init() {
      if (!this.option) return
      let { endPoint, port, useSSL, accessKey, secretKey } = this.option
      console.log('endPoint, port, useSSL, accessKey, secretKey', endPoint, port, useSSL, accessKey, secretKey)
      this.connectFailed = this.isEmpty(endPoint) || this.isEmpty(accessKey) || this.isEmpty(secretKey)
      if (this.connectFailed) return
      if(port) port = parseInt(port)
      this.minioClient = new Minio.Client({
        endPoint: endPoint,
        port: port ,
        useSSL: useSSL || false,
        accessKey: accessKey,
        secretKey: secretKey
      })
      this.getBucketList()
    },
    selBucket(name) {
      if (this.activeBucket === name) return
      this.currentPath = ''
      this.activeBucket = name
      this.getFileList(name)
    },
    showMenu(path) {
      this.currentPath += path
      this.getFileList(this.activeBucket, this.currentPath)
    },
    getBucketList() {
      this.minioClient.listBuckets((err, buckets) => {
        if (err) return console.log(err)
        console.log('buckets :', buckets)
        this.buckets = buckets
      })
    },
    removeBucket() {
      this.$confirm('是否要删除Bucket:' + this.rightClickBucket.name, '提示', { type: 'warning' }).then(() => {
        this.minioClient.removeBucket(this.rightClickBucket.name, (err) => {
          if (err) return this.$message.error('删除bucket失败,原因:' + err.message)
          this.$message.success('删除bucket成功')
          this.buckets.splice(this.buckets.indexOf(this.rightClickBucket), 1)
          this.selBucket(this.buckets[0].name)
        })
      })
    },
    getFileList(name, path) {
      this.files = []
      this.imgPreviewList = []
      const stream = this.minioClient.listObjects(name, path || '')
      stream.on('data', (obj) => {
        if (obj.name) {
          let name = obj.name.split('/')
          let split = obj.name.split('.')
          if (imgPrefix.indexOf(split[split.length - 1]) > -1) {
            let imgPath = this.option.endPoint + ':' + this.option.port + '/' + this.activeBucket + '/'
            console.log(this.option.endPoint.startsWith('http'))
            if (!this.option.endPoint.startsWith('http')) {
              imgPath = (this.option.useSSL ? 'https://' : 'http://') + imgPath
            }
            obj.imgPath = imgPath + obj.name
            this.imgPreviewList.push(obj.imgPath) // 预览列表
          }
          obj.name = name[name.length - 1]
        } else if (obj.prefix) {
          let path = obj.prefix.split('/')
          obj.prefix = path[path.length - 2] + '/'
        }
        this.files.push(obj)
      })
      stream.on('end', () => {
        this.bucketFiles = this.files
      })
    },
    search() {
      this.bucketFiles = this.files.filter((b) => {
        const name = b.name || b.prefix
        return name.indexOf(this.searchForm.key) > -1
      })
    },
    resetSearch() {
      this.searchForm.key = ''
      this.search()
      // this.getFileList(this.activeBucket, this.currentPath)
    },
    refreshFiles() {
      this.searchForm.key = ''
      this.getFileList(this.activeBucket, this.currentPath)
    },
    back() {
      const path = this.currentPath.split('/')
      if (path.length < 2) return this.refreshFiles()
      else if (path.length === 2 && path[1] === '') this.currentPath = ''
      else {
        path.splice(path.length - 2, 1)
        this.currentPath = path.join('/')
      }
      this.getFileList(this.activeBucket, this.currentPath)
    },
    isEmpty(n) {
      return n === undefined || n === null || n === ''
    },
    onContextmenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: () => {
              this.removeBucket()
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    createBucket() {
      if (this.createForm.name === '') return this.$message.error('Bucket名称不能为空!')
      this.minioClient.makeBucket(this.createForm.name, (err) => {
        if (err) {
          console.log('err', err)
          return this.$message.error('创建bucket失败,原因:' + err.message)
        }
        this.buckets.push({ creationDate: new Date(), name: this.createForm.name })
        this.activeBucket = this.createForm.name
        this.createForm.name = ''
        this.createBucketDialogVisible = false
      })
    },
    menuRightMenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: () => {
              this.removeMenu(this.rightClickMenu.prefix)
            }
          },
          {
            label: '下载',
            onClick: () => {
              this.downMenu()
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    fileRightMenu(event) {
      this.$contextmenu({
        items: [
          {
            label: '删除',
            onClick: async () => {
              const tag = await this.removeFile(this.currentPath + this.rightClickFile.name)
              if (tag) {
                this.getFileList(this.activeBucket, this.currentPath)
                this.$message.success('删除成功!')
                return
              }
              this.$message.error('删除失败!')
            }
          },
          {
            label: '下载d',
            onClick: () => {
              this.downFile()
            }
          }
        ],
        event, // 鼠标事件信息
        customClass: 'custom-class', // 自定义菜单 class
        zIndex: 3, // 菜单样式 z-index
        minWidth: 230 // 主菜单最小宽度
      })
    },
    removeMenu(prefix) {
      this.pageLoading = true
      const stream = this.minioClient.listObjects(this.activeBucket, this.currentPath + prefix, true)
      stream.on('data', (obj) => {
        this.removeFile(obj.name)
      })
      stream.on('end', () => {
        this.back()
        this.pageLoading = false
        this.$message.success('删除目录成功！')
      })
    },
    downMenu() {},
    removeFile(fileName) {
      return new Promise((resolve) => {
        this.minioClient.removeObject(this.activeBucket, fileName, (err) => {
          if (err) {
            console.log('删除文件失败。' + fileName, err)
            resolve(false)
          }
          resolve(true)
        })
      })
    },
    downFile() {}
  },
  created() {
    this.init()
  }
}
</script>
<style scoped>
.color-primary {
  color: #66b1ff;
}
.bucket-box {
  display: flex;
  /* flex-wrap: wrap; */
}
.bucket-item {
  width: 23%;
  height: 50px;
  border: 1px solid #f44336;
  border-radius: 8px;
  text-align: center;
  line-height: 50px;
  font-weight: 600;
  margin: 10px 0.948%;
  display: inline-block;
  cursor: pointer;
  transition: all 0.3s ease-in-out;
}
.bucket-item > .bucket-item-title {
  transition: all 0.3s ease-in-out;
  font-size: 22px;
}
.bucket-item:hover,
.active-bucket {
  background-color: aliceblue;
}
.bucket-item:hover > .bucket-item-title,
.active-bucket > .bucket-item-title {
  font-size: 30px;
}

.tool-box,
.current-path {
  padding: 0 10px;
  color: #333333;
  font-weight: 600;
}

.file-box {
  display: flex;
  flex-wrap: wrap;
  max-height: calc(100% - 170px);
  overflow: auto;
}
.file-item {
  width: 10%;
  height: 100px;
  margin: 10px;
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
.file-item > .file > .el-image {
  max-width: 80%;
  flex-shrink: 0;
  height: 80px;
  transition: all 0.3s ease-in-out;
}
.file-item > .file:hover > .el-image {
  max-width: 120%;
  width: 120%;
  height: 100%;
}
.file-item > .file > i {
  color: aqua;
}
.file-item > .menu > i {
  color: chartreuse;
}
</style>
