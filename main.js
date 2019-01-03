let imgCanvas = document.querySelector("#imgCanvas")
let dashFrame = document.querySelector("#dashFrame")
let pictureFrame = document.querySelector("#pictureFrame")
let scalePointer = document.querySelector("#scalePointer")
let scaleRange = document.querySelector("#scaleRange")
let scalePrecentage = document.querySelector("#scalePrecentage")
let cropFrame = document.querySelector("#cropFrame")
let cropButton = document.querySelector("#crop")
let eraserButton = document.querySelector("#eraser")
let toolKit = document.querySelector("#toolKit")
let eraserControls = Array.from(document.getElementsByClassName("eraserControls"));
let eraserPointer = document.querySelector("#eraserPointer")
let downloadButton = document.querySelector("#downloadButton")
let delay = null;
let x_CanvasDiff = 0;//canvas和鼠标之间在x轴方向上的差
let y_CanvasDiff = 0;//canvas和鼠标之间在y轴方向上的差
let x_PicFrameDiff = 0;//鼠标在x方向上与pictureframe的距离
let y_PicFrameDiff = 0;//鼠标在y方向上与pictureframe的距离
let x_cropDiff = 0;//鼠标在x方向上与cropframe的距离
let y_cropDiff = 0;//鼠标在y方向上与cropframe的距离
let scaleXDiff = 0;//放大后canvas体系和实际体系在x轴上的差
let scaleYDiff = 0;//放大后canvas体系和实际体系在y轴上的差
let state = Object.create(null);
state["context"] = imgCanvas.getContext("2d")
state.scale = 1;
state.mode = "ordinary"
let imgCanvasSize = imgCanvas.getBoundingClientRect();
let pictureFrameSize = pictureFrame.getBoundingClientRect();
//导入图片，结果保存在state里
function picSelector(){
  //导入图片
  let input = document.createElement("input");
  input.setAttribute("type","file");
  input.setAttribute("accept","image/*")
  input.addEventListener("change",event=>{
    if (input.files[0] == null) {
      console.log("failed to load img")
    }else{
      let reader = new FileReader();
      reader.addEventListener("load",event=>{
        let img = new Image()
        img.src = reader.result;
        img.onload = ()=>{
          //调整canvas大小
          imgCanvas.width = img.width;
          imgCanvas.height = img.height
          state["width"] = img.width;
          state["height"] = img.height
          //使得图片居中
          pictureFrameSize = pictureFrame.getBoundingClientRect();
          imgCanvas.style.left = (pictureFrameSize.width-imgCanvas.width)/2 + "px"
          imgCanvas.style.top = 0.8*(pictureFrameSize.height-imgCanvas.height)/2 + "px"
        }
        //显示canvas
        dashFrame.style.display = "none"
        imgCanvas.style.display = "block"
        pictureFrame.style.border = "2px solid #4DC3FF"
        toolKit.style.display = "block"
        //开始画
        img.addEventListener("load",()=>{
          state.context.drawImage(img,0,0)
          state.originalData = state.context.getImageData(0,0,state.width,state.height);
          state.currentData = state.context.getImageData(0,0,state.width,state.height);
        })
      })
      reader.readAsDataURL(input.files[0])
    }
  })
  input.click()
  input.remove()
}
//根据不同的mode,产生鼠标移动不同的效果。
imgCanvas.addEventListener("mousedown",event=>{
  imgCanvasSize = imgCanvas.getBoundingClientRect();
  pictureFrameSize = pictureFrame.getBoundingClientRect();
  //首次点击imgCanvas，鼠标的位置记录。
  x_CanvasDiff = Math.round(event.clientX - imgCanvasSize.left)
  y_CanvasDiff = Math.round(event.clientY - imgCanvasSize.top)
  x_PicFrameDiff = Math.round(event.clientX - pictureFrameSize.left)
  y_PicFrameDiff = Math.round(event.clientY -pictureFrameSize.top)
  if (state.mode == "eraser"){
    eraseCanvas(event);
    imgCanvas.addEventListener("mousemove",eraseCanvas)
  }else if (state.mode == "crop"){
    cropFrame.style.display = "block";
    cropFrame.style.top = y_PicFrameDiff - 3 + "px";//3为点击时候的调整
    cropFrame.style.left = x_PicFrameDiff - 3 + "px";
    cropFrame.style.width = 0 + "px";
    cropFrame.style.height = 0 + "px";
    //cropFrame和imgCanvas都加event是为了避免鼠标超出范围导致拉拽停滞。
    cropFrame.addEventListener("mousemove",drawFrame)
    imgCanvas.addEventListener("mousemove",drawFrame)
  }else{
    pictureFrame.addEventListener("mousemove",drag)
  }
})
//橡皮擦功能
function eraseCanvas(event){
  if (event.buttons == 0){
    imgCanvas.removeEventListener("mousemove",eraseCanvas)
  }else{
    let eraserPointerSize = eraserPointer.getBoundingClientRect()
    imgCanvasSize = imgCanvas.getBoundingClientRect();
    let left = Math.round((eraserPointerSize.left - imgCanvasSize.left)/state.scale)
    let right = Math.round((eraserPointerSize.right - imgCanvasSize.left)/state.scale)
    let top = Math.round((eraserPointerSize.top - imgCanvasSize.top)/state.scale)
    let bottom = Math.round((eraserPointerSize.bottom - imgCanvasSize.top)/state.scale)
    let radius = Math.round((right - left)/2);
    //获得像素点的结构数组。
    //因为橡皮擦是圆形，为了使得擦出的是圆形，就要知道在这个圆里每一行要擦掉多少个像素。
    //这个函数利用勾股定理，获得1/4圆部分
    function halfCirclePixelsGroup(radius){
      let row = [];
      for (let i = 0;i<radius;i++){
        let pixels1 =Math.sqrt(radius*radius - i*i)
        let pixels2 = Math.sqrt(radius*radius - (i+1)*(i+1))
        let pixels = Math.round((pixels1+pixels2)/2)
        row.push(pixels)
      }
      return row;
    }
    //根据位置与canvasX、Y方向上的差距算出像素点。
    function pixelsToPosition(widthDiff,heightDiff){
      return state.width*heightDiff+widthDiff;
    }
    //找到圆心的位置（widthDiff，heightDiff）
    //-1 为误差调整
    let widthDiff = Math.round((right+left)/2) - 1;
    let heightDiff = Math.round((bottom+top)/2) - 1;
    let removingPixels = [];
    let pixelsGroup = halfCirclePixelsGroup(radius)
    //获得要擦掉的像素位置的数组。
    for (let i = 0;i<pixelsGroup.length;i++){
      for (let k = 0;k<pixelsGroup[i];k++){
        let _widthDiff = widthDiff;
        let _heightDiff = heightDiff;
        let adjWidthDiffLeft = _widthDiff - k;
        let adjWidthDiffRight = _widthDiff + k;
        let adjHeightDiffTop = _heightDiff - i
        let adjHeightDiffBottom = _heightDiff +i;
        let targetPixelsLeftTop = pixelsToPosition(adjWidthDiffLeft,adjHeightDiffTop);
        let targetPixelsRightTop = pixelsToPosition(adjWidthDiffRight,adjHeightDiffTop);
        let targetPixelsLeftBottom = pixelsToPosition(adjWidthDiffLeft,adjHeightDiffBottom);
        let targetPixelsRightBottom = pixelsToPosition(adjWidthDiffRight,adjHeightDiffBottom);
        let targetPixels = [targetPixelsLeftTop,targetPixelsRightTop,targetPixelsLeftBottom,targetPixelsRightBottom]
        targetPixels.forEach(p=>{
          if (!removingPixels.includes(p)){
            removingPixels.push(p)
          }
        })
      }
    }

    for (let i=0;i<removingPixels.length;i++){
      state.currentData.data[removingPixels[i]*4] = 255;
      state.currentData.data[removingPixels[i]*4+1] = 255;
      state.currentData.data[removingPixels[i]*4+2] = 255;
      state.currentData.data[removingPixels[i]*4+3] = 0;
    }
    state.context.clearRect(0,0,state.width,state.height)
    state.context.putImageData(state.currentData,0,0)
  }
}
//画剪切框功能
function drawFrame(event){
  if (event.buttons == 0) {
    cropFrame.removeEventListener("mousemove",drawFrame)
    imgCanvas.removeEventListener("mousemove",drawFrame)
  }else{
      let top = y_PicFrameDiff - 3;
      let left = x_PicFrameDiff - 3;
      let width = event.clientX - pictureFrameSize.left - x_PicFrameDiff;
      let height = event.clientY - pictureFrameSize.top -y_PicFrameDiff;
      //使得可以上下左右画出框架。
      if (width < 0){
        left = event.clientX - pictureFrameSize.left;
      }
      if (height<0){
        top = event.clientY - pictureFrameSize.top;
      }
      cropFrame.style.top = top + "px";
      cropFrame.style.left = left + "px";
      cropFrame.style.width = Math.abs(width) + "px";
      cropFrame.style.height = Math.abs(height) + "px";
  }
}
//移动框架,跟drag function类似。
cropFrame.addEventListener("mousedown",()=>{
  x_cropDiff = Math.round(event.clientX - cropFrame.getBoundingClientRect().left);
  y_cropDiff = Math.round(event.clientY - cropFrame.getBoundingClientRect().top)
  console.log(x_cropDiff)
  pictureFrame.addEventListener("mousemove",dragFrame)
})

function dragFrame(event){
  if (event.buttons == 0){
    pictureFrame.removeEventListener("mousemove",dragFrame)
    cropFrame.style.cursor = "grab"
  }else{
    if (!delay){//
      cropFrame.style.cursor = "grabbing"
      cropFrame.style.top = event.clientY - y_cropDiff  - pictureFrameSize.top+ "px";
      cropFrame.style.left = event.clientX - x_cropDiff  - pictureFrameSize.left+ "px";
      delay = event;
      setTimeout(()=>{
        delay = null;
      },50)
    }
  }
}
//实现方框剪切功能
function cropCut(){
  if (cropFrame.style.display == "none"){
    alert("请先框出要裁剪的区域");
    return;
  }
  imgCanvasSize = imgCanvas.getBoundingClientRect();
  let cropSize = cropFrame.getBoundingClientRect();
  //算出框架与canvas之间的差，调整长宽到初始位置以便找到像素点
  let left = Math.round((cropSize.left - imgCanvasSize.left)/state.scale) - 1;//1为鼠标精确点击的调整
  let top = Math.round((cropSize.top - imgCanvasSize.top)/state.scale) - 1;
  let right = Math.round((cropSize.right - imgCanvasSize.left)/state.scale) - 1;
  let bottom = Math.round((cropSize.bottom - imgCanvasSize.top)/state.scale) - 1;
  let width = state.width;
  let height = state.height;
  let dataLength = width*height;
  for (let i = 0;i<dataLength;i++){
    let x = i%width;
    let y = Math.round(i/width);
    //根据筛选改变像素值
    if (x<left||x>right||y<top||y>bottom){
      state.currentData.data[4*i] = 255;
      state.currentData.data[4*i+1] = 255;
      state.currentData.data[4*i+2] = 255;
      state.currentData.data[4*i+3] = 0;
    }
  }
  state.context.clearRect(0,0,state.width,state.height)
  state.context.putImageData(state.currentData,0,0)
  changeToMode("ordinary")
}
//把图片还原
function reset(){
  state.context.clearRect(0,0,state.width,state.height)
  state.context.putImageData(state.originalData,0,0)
  //let data = state.originalData.data;
  for (let i =0;i<state.originalData.data.length;i++){
    state.currentData.data[i] = state.originalData.data[i]
  }
}
//实现拖动图片功能
function drag(event){
  if (event.buttons == 0){
    pictureFrame.removeEventListener("mousemove",drag)
    imgCanvas.style.cursor = "grab"
  }else{
    if (!delay){
      //增加一个delay，因为拖动的一个快速发生的event。
      //imgCanvas.style.left 是相对pictureFrame的top left而言的。
      imgCanvas.style.cursor = "grabbing"
      imgCanvas.style.top = event.clientY - y_CanvasDiff + scaleYDiff - pictureFrameSize.top+ "px";
      imgCanvas.style.left = event.clientX - x_CanvasDiff + scaleXDiff - pictureFrameSize.left+ "px";
      delay = event;
      setTimeout(()=>{
        delay = null;
      },50)
    }
  }
}
//图片放大缩小功能，结果保存在state里。
scaleRange.addEventListener("mousedown",event=>{
  scaleImage(event);
  changeToMode("ordinary")
  scaleRange.addEventListener("mousemove",scaleImage)
})

function scaleImage(event){
  if (event.buttons == 0){
    scaleRange.removeEventListener("mousemove",scaleImage)
  }else{
    let move = event.clientX - scaleRange.getBoundingClientRect().left;
    // scaleRange是150px
    if (move>0&&move<148){
      scalePointer.style.left = move - 2 + "px"
      //最多只能放大3倍：2*150/100
      state.scale = Math.ceil(2*move)/100
      scalePrecentage.textContent = Math.round(state.scale*100)+"%";
      let scaledCanvasSize = imgCanvas.getBoundingClientRect();
      imgCanvas.style.transform = `scale(${state.scale})`;
      imgCanvasSize = imgCanvas.getBoundingClientRect();
      //放大后，图片相对与pictureFrame的坐标变了，scaleXdiff调整回来。
      scaleXDiff += scaledCanvasSize.x -imgCanvasSize.x
      scaleYDiff += scaledCanvasSize.y - imgCanvasSize.y
    }
  }
}
//除了mousedown效果不在这里改变，button样式和鼠标样式都在这里改变。
function changeToMode(mode){
  //先把所有样式清除
  let buttons = [cropButton,eraserButton]
  buttons.forEach(b=>{
    b.classList.remove("stateActiveForBtn");
    b.nextElementSibling.style.display = "none"
  })
  cropFrame.style.display = "none";
  eraserPointer.style.display = "none";
  //已启动的button再此点击则回到ordinary;
  if (state.mode == mode){
    state.mode = "ordinary"
  }else{
    state.mode = mode;
  }
  //根据不同的mode改变样式：鼠标和button。
  if (state.mode == "ordinary"){
    imgCanvas.onmouseover = ()=>{
      imgCanvas.style.cursor = "grab"
    }
  }else if(state.mode == "crop"){
    imgCanvas.onmouseover = ()=>{
      imgCanvas.style.cursor = "move"
    }
    cropButton.classList.add("stateActiveForBtn")
    cropButton.nextElementSibling.style.display = "inline-block"
  }else{
    imgCanvas.onmouseover = ()=>{
      imgCanvas.style.cursor = "none"
      eraserPointer.style.display = "inline-block";
    }
    imgCanvas.onmousemove = event=>{
      pictureFrameSize = pictureFrame.getBoundingClientRect();
      eraserPointer.style.top = event.clientY - pictureFrameSize.top+ "px"
      eraserPointer.style.left = event.clientX - pictureFrameSize.left+ "px";
    }
    eraserButton.classList.add("stateActiveForBtn");
    eraserButton.nextElementSibling.style.display = "inline-block";
  }
}

function eraserResize(n){
  eraserControls.forEach(e=>e.classList.remove("eraserActive"));
  eraserControls[n].classList.add("eraserActive")
  eraserPointer.style.width = (n+1)*10 + "px";
  eraserPointer.style.height = (n+1)*10 + "px";
}

function downloadImage(){
  let link = document.createElement("a");
  link.setAttribute("href",imgCanvas.toDataURL())
  link.setAttribute("download","picture.png")
  link.click();
  link.remove()
}
