"use strict"

var path = require('path'),
fs = require("fs"),
ejs = require('ejs'),
stylus = require('stylus');

var fepUtil = {}

fepUtil.regStr = '(url\\s*\\(\\s*[\'\"]*\\s*)(?:(?:((?:(?!\\/img\\/)(?!\\}).)*)(\\/img\\/(?:(?!\\))(?![\'\"])(?!\\?).)+))|(img\\/(?:(?!\\))(?![\'\"])(?!\\?).)+))(\\?*[^\"\')]*)';


fepUtil.extand = function(target, source) {
  for (var p in source) {
    if (source.hasOwnProperty(p)) {
      target[p] = source[p];
    }
  }
  return target;
};

/**
 * [parseCSSBgUrl 正则替换css背景图片地址]
 * url(img/test.png => url(../img/test.png?version=123
 * url(/img/test.png => url(../img/test.png?version=123
 * url(./img/test.png => url(../img/test.png?version=123
 * url(../img/test.png => url(../img/test.png?version=123
 * url(http://www.lxj.com/img/test.png => url(http://www.lxj.com/img/test.png?version=123
 * @param  {[string]} str [正则替换前的字符串]
 * @return {[string]}     [正则替换后的字符串]
 */
fepUtil.parseCSSBgUrl = function(str) {
  var mhString = str,
    under,
    mhs = mhString.match(new RegExp(this.regStr, 'i')),
    cdn = siteConfig.cdn ? siteConfig.cdn.replace(/[\/\\]+$/, '') : '..';
  if (mhs) {
    //console.log(mhs)
    if (mhs[2] !== under) {
      /^http/.test(mhs[2]) && (cdn = '');
      mhString = mhs[1] + (cdn || mhs[2]) + mhs[3] + '?version=' + siteConfig.static.ver;
    } else {
      mhString = mhs[1] + cdn + '/' + mhs[4] + '?version=' + siteConfig.static.ver;
    }
  }
  return mhString
}


/**
 * [tplData 获取页面的测试数据]
 * @param  {[type]} dest [description]
 * @param  {[type]} src  [当前页面路径]
 * @return {[objet]}      [返回json格式的数据对象]
 */
fepUtil.tplData = function(src) {
  var srcString = src.toString(),
    srcDirName = srcString.match(/.+\//)[0],
    srcDataFile = './' + srcString.match(/.+\./)[0] + 'json',
    pageData = {},
    defaultData = this.extand({}, siteConfig.static),
    jsonPath = './' + srcDirName + 'data.json';

  if (fs.existsSync(srcDataFile)) {
    pageData = require(srcDataFile);
    return this.extand(defaultData, pageData);
  }
  if (fs.existsSync(jsonPath)) {
    pageData = require(jsonPath);
    return this.extand(defaultData, pageData);
  }
  //console.log("dest="+dest,"src="+src,src[0].toString().match(/.+\//)[0])
  //var pageData = require('/locals.json')
  return defaultData;
}

/**
 * [stylusCompile html,ejs文件解析]
 * @param  {[Object]}   req  [http Request Object]
 * @param  {[Object]}   res  [http Response Object]
 * @param  {Function} next [connect api]
 * @return {[type]}        [description]
 */
fepUtil.ejsCompile = function(req, res, next) {
  var reqUrl = req.url,
    extname = path.extname(req.url),
    realextname = extname.replace(/(?:\?|#)+.*/ig, ''),
    reqPath = ( '.' + reqUrl).replace(/(?:\?|#)+.*/ig, ''),
    data;

  if (extname == "" && fs.existsSync('./' + reqUrl.replace(/\/+$/, '/') + 'index.html')) {
    reqUrl = reqUrl.replace(/\/+$/g, '/') + 'index.html';
    extname = path.extname(reqUrl);
    realextname = extname.replace(/(?:\?|#)+.*/ig, '');
    reqPath = ( '.' + reqUrl).replace(/(?:\?|#)+.*/ig, '');
  }
  if (['.html','.htm','.shtml','.ejs'].indexOf(realextname)!==-1 && fs.existsSync(reqPath)) {
    var fileStr = fs.readFileSync(reqPath);
    var compileFn = ejs.compile(fileStr.toString(), {
      filename:reqPath
    });
    data = tplData('', [reqUrl]);
    res.end(compileFn(data));
  } else {
    return next();
  }
}

/**
 * [stylusCompile styl文件解析]
 * @param  {[Object]}   req  [http Request Object]
 * @param  {[Object]}   res  [http Response Object]
 * @param  {Function} next [connect api]
 * @return {[type]}        [description]
 */
fepUtil.stylusCompile = function(req, res, next) {
  var reqUrl = req.url,
    extname = path.extname(req.url),
    realextname = extname.replace(/(?:\?|#)+.*/ig, ''),
    reqPath = ( '.' + reqUrl).replace(/(?:\?|#)+.*/ig, '');

  if (realextname === '.styl' && fs.existsSync(reqPath)) {
    var fileContent =fs.readFileSync(reqPath);
    
    fileContent = fileContent.toString();
    fileContent = fileContent.replace(/@import\s*['"][^'"\n\r]+['"]/ig,function(k,ke){
    	return '/**'+k+'**/';
    });
    
    stylus(fileContent).set('filename', reqPath).render(function(err, css) {
	if (err) throw err;
	var imports = [];
	css = css.replace(/\/\*\*\s*@import\s*['"]([^'"\n\r]+)['"]\s*\*\*\//ig,function(k,ke){
		imports.push( "@import url('"+ke+"');");
		return ''
	});
	res.writeHead(200, {'Content-Type': 'text/css'});
	res.end(imports.join('\n')+'\n'+css);
    });
    
    /**
    stylus.render(
      fileContent, 
      {
        filename: __dirname + reqUrl
      },
      function(err, css) {
        if (err) throw err;
        console.log(css);
        res.end(css);
      });
    **/
  } else {
    return next();
  }
}

module.exports = fepUtil;
