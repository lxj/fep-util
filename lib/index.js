"use strict"

var path = require('path'),
  url = require('url'),
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
 * fepUtil.parseCSSBgUrl (str,{cdn:siteConfig.cdn,version:siteConfig.static.ver})
 * [parseCSSBgUrl 正则替换css背景图片地址]
 * url(img/test.png => url(../img/test.png?version=123
 * url(/img/test.png => url(../img/test.png?version=123
 * url(./img/test.png => url(../img/test.png?version=123
 * url(../img/test.png => url(../img/test.png?version=123
 * url(http://www.lxj.com/img/test.png => url(http://www.lxj.com/img/test.png?version=123
 * @param  {[string]} str [正则替换前的字符串]
 * @return {[string]}     [正则替换后的字符串]
 */
fepUtil.parseCSSBgUrl = function(str, option) {
  var option = option || {},
    mhString = str,
    under,
    mhs = mhString.match(new RegExp(this.regStr, 'i')),
    version = option.version,
    cdn = option.cdn ? option.cdn.replace(/[\/\\]+$/, '') : '..';
  if (mhs) {
    //console.log(mhs)
    if (mhs[2] !== under) {
      /^http/.test(mhs[2]) && (cdn = '');
      mhString = mhs[1] + (cdn || mhs[2]) + mhs[3] + '?version=' + version;
    } else {
      mhString = mhs[1] + cdn + '/' + mhs[4] + '?version=' + version;
    }
  }
  return mhString
}

fepUtil.escapeHTML = function(text) {
  if (text && text.length > 0) {
    return text.replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  } else {
    return "";
  }
}

fepUtil.sourceView = function(htmlStr) {
    var tpl = '<!doctype html><html><head><meta charset="utf-8"><title>首页</title></head><body><pre>{{content}}</pre></body></html>',
      escapeHTML = this.escapeHTML(htmlStr);

    escapeHTML = escapeHTML.replace(/(&lt;%\s*include\s*)((?:(?!%\s*&gt;)(?!\s)[\s\S])+)(\s*%\s*&gt;)/ig, function(k, k2, k3, k4) {
      return k2 + '<a href="' + k3 + '?source=1">' + k3 + '</a>' + k4
    })
    return tpl.replace('{{content}}', escapeHTML);
  }
  /**
   * [tplData 获取页面的测试数据]
   * fepUtil.tplData('src/pages/index.html',siteConfig.static)
   * @param  {[type]} dest [description]
   * @param  {[type]} src  [当前页面路径]
   * @return {[objet]}      [返回json格式的数据对象]
   */
fepUtil.tplData = function(src, defaultData) {
  var srcString = src.toString(),
    srcString = (/^\//.test(srcString) ? '.' : './') + srcString,
    srcDirName = srcString.match(/.+\//)[0],
    srcDataFile = srcString.match(/.+\./)[0] + 'json',
    pageData = {},
    defaultData = this.extand({}, defaultData),
    jsonPath = srcDirName + 'data.json';

  if (fs.existsSync(srcDataFile)) {
    var jsonStr = fs.readFileSync(srcDataFile)
    pageData = JSON.parse(jsonStr.toString());
    return this.extand(defaultData, pageData);
  }
  if (fs.existsSync(jsonPath)) {
    var jsonStr = fs.readFileSync(jsonPath)
    pageData = JSON.parse(jsonStr.toString());
    return this.extand(defaultData, pageData);
  }
  return defaultData;
}

/**
 * [stylusCompile html,ejs文件解析]
 * @param  {[Object]}   req  [http Request Object]
 * @param  {[Object]}   res  [http Response Object]
 * @param  {Function} next [connect api]
 * @return {[type]}        [description]
 */
fepUtil.ejsCompile = function(option) {
  var option = option || {},
    self = this,
    data = option.data || {},
    serverOtions = option.serverOtions || {},
    protocol = serverOtions.protocol || 'http',
    defaultData = option.defaultData || {};
  return function(req, res, next) {
    var reqUrl = req.url,
      extname = path.extname(req.url),
      removeUrlParam = function(url) {
        return url.replace(/(?:\?|#)+.*/ig, '')
      },
      realextname = removeUrlParam(extname),
      reqPath = removeUrlParam('.' + reqUrl),
      debug = /\/src\/(?:(?!pages).)*pages\//.test(reqUrl);

    if (extname == "" && fs.existsSync('./' + reqUrl.replace(/\/($|[#?].*)/, '/') + 'index.html')) {
      reqUrl = reqUrl.replace(/\/($|[#?].*)/g, function(k, k2) {
        return '/index.html' + k2
      });
      extname = path.extname(reqUrl);
      realextname = removeUrlParam(extname);
      reqPath = removeUrlParam('.' + reqUrl);
    }

    if (['.html', '.htm', '.shtml', '.ejs'].indexOf(realextname) !== -1 && fs.existsSync(reqPath)) {
      var fileStr = fs.readFileSync(reqPath),
        locationHref = protocol + '://' + req.headers.host + reqUrl,
        locationParam = url.parse(locationHref, true),
        resContent = "";

      if (locationParam.query.source && locationParam.query.source != 0) {
        resContent = fepUtil.sourceView(fileStr.toString())
      } else {
        if (debug) {
          var dynamicData = {
              request: req,
              reqUrl: locationHref,
              location: locationParam,
              debug: debug
            },
            dataTmp = self.extand({}, data),
            defaultDataTmp = self.extand({}, typeof defaultData === "function" ? defaultData.call(dynamicData) : defaultData),
            jsonData,
            compileFn = ejs.compile(fileStr.toString(), {
              filename: reqPath
            });
          defaultDataTmp = self.extand(
            defaultDataTmp,
            dynamicData
          );
          dataTmp = self.extand(dataTmp, defaultDataTmp);
          jsonData = self.tplData(reqUrl, dataTmp);
          resContent = compileFn(jsonData)
        } else {
          return next();
        }
      }
      res.writeHead(200, {
        'Content-Type': 'text/html'
      });
      res.end(resContent);
    } else {
      return next();
    }
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
    reqPath = ('.' + reqUrl).replace(/(?:\?|#)+.*/ig, '');

  if (realextname === '.styl' && fs.existsSync(reqPath)) {
    var fileContent = fs.readFileSync(reqPath);

    fileContent = fileContent.toString();
    fileContent = fileContent.replace(/@import\s*['"][^'"\n\r]+['"]/ig, function(k, ke) {
      return '/**' + k + '**/';
    });

    stylus(fileContent).set('filename', reqPath).render(function(err, css) {
      if (err) throw err;
      var imports = [];
      css = css.replace(/\/\*\*\s*@import\s*['"]([^'"\n\r]+)['"]\s*\*\*\//ig, function(k, ke) {
        imports.push("@import url('" + ke + "');");
        return ''
      });
      res.writeHead(200, {
        'Content-Type': 'text/css'
      });
      res.end(imports.join('\n') + '\n' + css);
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