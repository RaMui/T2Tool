// ==UserScript==
// @name         T2Tool(tool for tmall & taobao)
// @namespace    http://tampermonkey.net/
// @version      0.3
// @author       RaMui
// @match        *://detail.tmall.com/item.htm?*
// @match        *://item.taobao.com/item.htm?*
// @grant        none
// ==/UserScript==

const getValue = (observer) => {
  if (window.location.host.includes('taobao')) {
    const map = Hub.config.get('sku').valItemInfo.propertyMemoMap;
    const domList = document.getElementsByClassName('J_TSaleProp tb-img tb-clearfix')[0].getElementsByTagName('li');
    for (const iterator of domList) {
      iterator.getElementsByTagName('a')[0].click();
      let sku = iterator.getElementsByTagName('span')[0].textContent;
      const skuDataId = iterator.dataset.value;
      if (map.hasOwnProperty(skuDataId)) {
        sku = map[skuDataId];
      }
      currentData.push(
        {
          sku: sku,
          price: document.getElementsByClassName('tb-rmb-num')[0].textContent,
          quantity: 1,
          unitPrice: document.getElementsByClassName('tb-rmb-num')[0].textContent
        }
      )
    }
  } else {
    const domList = document.querySelector('.tm-clear.J_TSaleProp.tb-img     ').querySelectorAll('li');
    for (const iterator of domList) {
      iterator.getElementsByTagName('a')[0].click();
      const config = { attributes: true, childList: true, subtree: true };
      const callback = (mutationsList) => {
        for (const it of mutationsList) {
          if (it.target.id === 'J_StrPriceModBox') {
            currentData.push(
              {
                sku: iterator.getElementsByTagName('span')[0].textContent,
                price: document.querySelector('.tm-price').textContent,
                quantity: 1,
                unitPrice: document.querySelector('.tm-price').textContent
              }
            )
            break
          }
        }
      };
      const observer = new MutationObserver(callback);
      observer.observe(document.getElementById('J_StrPriceModBox'), config);
    }
  }
  const div = document.createElement('div');
  div.setAttribute('id', 'ramuiDiv');
  document.getElementById('detail').insertBefore(div, document.getElementById('detail').firstChild);
  document.getElementById('ramuiDiv').appendChild(app.render());
  observer.disconnect();
}

class RaMuiElement {
  constructor(options) {
    this.options = options
    this.tagName = options.tagName;
    this.props = options.props || {};
    this.children = options.children || [];
    this.styles = options.styles || {};
    this.listener = options.listener || {};
    this.visible = options.visible;
    this.columns = options.columns || {};
    this.rows = options.rows || [];
    this.tableHandler();
    this.init();
  }

  render() {
    const el = document.createElement(this.tagName);
    for (let propName in this.props) {
      el.setAttribute(propName, this.props[propName]);
    }
    if (this.visible !== void 0) {
      this.styles['display'] = this.visible ? '' : 'none';
    }
    for (let styleName in this.styles) {
      el.style[styleName] = this.styles[styleName];
    }
    this.children.forEach(child => {
      var childEl = null;
      if (child instanceof RaMuiElement) {
        childEl = child.render();
      } else {
        childEl = document.createTextNode(child);
      }
      el.appendChild(childEl);
    });
    for (let func in this.listener) {
      el.addEventListener(func, this.listener[func]);
    }
    return el;
  }

  tableHandler() {
    if (this.tagName === 'table' && this.rows.length > 0 && Object.keys(this.columns).length > 0) {
      const headtr = new RaMuiElement({
        tagName: 'tr',
        children: [],
      });
      for (const key in this.columns) {
        const td = new RaMuiElement({
          tagName: 'td',
          children: [this.columns[key]],
          styles: { border: '2px solid #cad9ea' }
        })
        headtr.children.push(td);
      }
      this.children.push(headtr);
      this.rows.forEach(item => {
        const tr = new RaMuiElement({
          tagName: 'tr',
          children: [],
        });
        for (const key in item) {
          const td = new RaMuiElement({
            tagName: 'td',
            children: [item[key]],
            styles: { border: '2px solid #cad9ea' }
          })
          tr.children.push(td)
        }
        this.children.push(tr);
      })
    }
  }

  init() {
    this.observer();
  }

  observer() {
    const handler = {
      get: (target, propkey) => {
        return target[propkey];
      },
      set: (target, propkey, value) => {
        target[propkey] = value;
        if (propkey === 'visible') {
          this.hidden(value);
        } else {
          this.domUpdate(target);
        }
        return true;
      }
    }
    this.options = new Proxy(this.options, handler);
  }

  hidden(visible) {
    document.getElementById(this.props.id).style.display = visible ? '' : 'none';
  }

  domUpdate(target) {
    const parent = document.getElementById(this.props.id).parentNode;
    parent.replaceChild(new RaMuiElement(target).render(), document.getElementById(this.props.id));
  }
}

const currentData = [];

let skuDataAfterHandler = [];

const sukDataHandler = (separate, unit) => {
  skuDataAfterHandler = [];
  currentData.forEach(item => {
    const itemCopy = { sku: item.sku, price: item.price, quantity: item.quantity, unitPrice: item.unitPrice };
    for (const iterator of separate) {
      let open = itemCopy.sku.indexOf(iterator[0]) + 1;
      const close = itemCopy.sku.indexOf(iterator[1]);
      if (open < 0 || close < 0) {
        continue;
      }
      let unitStr = itemCopy.sku.substring(open, close);
      if (!unitStr.includes(unit)) {
        continue;
      }
      let hasSeparate = false;
      hasSeparate = isNaN(unitStr.split(unit)[0].replace(/[^0-9_]/g, ''));
      itemCopy.quantity = hasSeparate ? 1 : unitStr.split(unit)[0].replace(/[^0-9_]/g, '');
      itemCopy.unitPrice = (itemCopy.price / itemCopy.quantity).toFixed(3);
      if (!hasSeparate) {
        itemCopy.sku = itemCopy.sku.substring(0, --open)
      }
      break;
    }
    skuDataAfterHandler.push(itemCopy);
  })
  document.getElementById('skuDataTabId2').click();
}

const exportfile = () => {
  const data = document.getElementById('skuDataTabId1').style.backgroundColor === 'white' ? currentData : skuDataAfterHandler;
  let str = `名称,价格,数量,单价,\n`;
  data.forEach(item => {
    str += `${item.sku},${item.price},${item.quantity},${item.unitPrice},\n`
  });
  str = encodeURIComponent(str);
  const csv = "data:text/csv;charset=utf-8,\ufeff" + str;
  var link = document.createElement("a");
  link.setAttribute("href", csv);
  link.setAttribute("download", "data.csv");
  link.click();
}

const tab1 = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataTabId1' },
  styles: { width: '10%', height: '100%', textAlign: 'center', cursor: 'pointer', backgroundColor: 'white' },
  children: ['原始'],
  listener: {
    mouseover: (e) => {

    },
    mouseout: (e) => {

    },
    click: (e) => {
      skuTable.options.rows = currentData;
      document.getElementById('skuDataTabId2').style.backgroundColor = '#E7E7E7';
      document.getElementById('skuDataTabId2').style.cursor = 'pointer';
      e.target.style.backgroundColor = 'white';
      e.target.style.cursor = 'not-allowed';
      setting.options.visible = true;
    }
  }
})
const tab2 = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataTabId2' },
  styles: { width: '10%', height: '100%', textAlign: 'center', cursor: 'pointer', backgroundColor: '#E7E7E7' },
  children: ['处理'],
  listener: {
    mouseover: (e) => {

    },
    mouseout: (e) => {

    },
    click: (e) => {
      skuTable.options.rows = skuDataAfterHandler;
      document.getElementById('skuDataTabId1').style.backgroundColor = '#E7E7E7';
      document.getElementById('skuDataTabId1').style.cursor = 'pointer';
      e.target.style.cursor = 'not-allowed';
      e.target.style.backgroundColor = 'white';
      settingDiv.options.visible = false;
      setting.options.visible = false;
    }
  }
})

const setting = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataSettingId' },
  styles: { width: '5%', height: '100%', textAlign: 'center', cursor: 'pointer', backgroundColor: '#E7E7E7' },
  children: ['⚙'],
  listener: {
    mouseover: (e) => {
      e.target.style.backgroundColor = '#4CAF50';
      e.target.style.color = 'white';
    },
    mouseout: (e) => {
      e.target.style.backgroundColor = '#E7E7E7';
      e.target.style.color = 'black';
    },
    click: () => {
      settingDiv.options.visible = !settingDiv.options.visible;
    }
  }
})

const exit = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataExitId' },
  styles: { width: '5%', height: '100%', textAlign: 'center', cursor: 'pointer', backgroundColor: '#E7E7E7' },
  children: ['×'],
  listener: {
    mouseover: (e) => {
      e.target.style.backgroundColor = 'red';
      e.target.style.color = 'white';
    },
    mouseout: (e) => {
      e.target.style.backgroundColor = '#E7E7E7';
      e.target.style.color = 'black';
    },
    click: () => {
      skuDataTableDiv.options.visible = false
      ramui.options.visible = true;
    }
  }
})

const tab3 = new RaMuiElement({
  tagName: 'div',
  styles: { flex: '1', display: 'flex', flexDirection: 'row', justifyContent: 'flex-end' },
  children: [setting, exit],

})
const head = new RaMuiElement({
  tagName: 'div',
  styles: { width: '100%', height: '4%', display: 'flex', flexDirection: 'row', backgroundColor: '#E7E7E7' },
  children: [tab1, tab2, tab3]
})

const input = new RaMuiElement({
  tagName: 'input',
  props: { id: 'skuSeparate' },
  styles: { width: '50px', borderRadius: '4xp', border: '2px solid rgb(76, 175, 80)' }
})

const unitInput = new RaMuiElement({
  tagName: 'input',
  props: { id: 'skuUnit' },
  styles: { width: '50px', borderRadius: '4xp', border: '2px solid rgb(76, 175, 80)' }
})

const dataHandlerButton = new RaMuiElement({
  tagName: 'button',
  styles: {
    border: 'none',
    color: '#4CAF50',
    padding: '5px 10px',
    textAlign: 'center',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '4px',
    margin: '4px',
    border: '2px solid #4CAF50',
    height: '27px'
  },
  children: ['处理'],
  listener: {
    mouseover: (e) => {
      e.target.style.backgroundColor = '#4CAF50';
      e.target.style.color = 'white';
    },
    mouseout: (e) => {
      e.target.style.backgroundColor = 'white';
      e.target.style.color = '#4CAF50';
    },
    click: () => {
      sukDataHandler(document.getElementById('skuSeparate').value.split(','), document.getElementById('skuUnit').value);
    }
  }
});

const settingDiv = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataSettingDiv' },
  styles: {
    width: '100%',
    height: '30px',
  },
  visible: false,
  children: ['分割组:', input, '单位:', unitInput, dataHandlerButton],
});

const skuTable = new RaMuiElement({
  tagName: 'table',
  props: { id: 'skuDataTable' },
  styles: {
    width: '100%',
    height: 'auto',
    borderCollapse: 'collapse',
    margin: '0 auto',
    border: '1px solid #cad9ea'
  },
  columns: { sku: '名称', price: '价格', quantity: '数量', unitPrice: '单价' },
  rows: currentData
});

const center = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataDiv' },
  styles: { width: '100%', height: '87%', overflow: 'auto' },
  children: [settingDiv, skuTable]
})

const exportButton = new RaMuiElement({
  tagName: 'button',
  styles: {
    border: 'none',
    color: '#4CAF50',
    padding: '5px 10px',
    textAlign: 'center',
    cursor: 'pointer',
    borderRadius: '4px',
    fontSize: '4px',
    margin: '4px',
    border: '2px solid #4CAF50'
  },
  children: ['导出'],
  listener: {
    mouseover: (e) => {
      e.target.style.backgroundColor = '#4CAF50';
      e.target.style.color = 'white';
    },
    mouseout: (e) => {
      e.target.style.backgroundColor = 'white';
      e.target.style.color = '#4CAF50';
    },
    click: () => {
      exportfile();
    }
  }
});
const buttom = new RaMuiElement({
  tagName: 'div',
  styles: {
    width: '100%',
    height: '7%',
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center'
  },
  children: [exportButton]
});

const skuDataTableDiv = new RaMuiElement({
  tagName: 'div',
  props: { id: 'skuDataTableDiv' },
  styles: {
    width: '500px',
    height: '600px',
    border: '1px solid',
    top: '100px',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '5px 5px 5px #888888',
    position: 'absolute',
    zIndex: '9999',
    backgroundColor: 'white'
  },
  visible: false,
  children: [head, center, buttom],
});

const ramui = new RaMuiElement({
  tagName: 'button',
  props: { id: 'ramui' },
  styles: {
    width: '50px',
    height: '50px',
    backgroundColor: 'red',
    color: '#22e0ff',
    borderRadius: '25px',
    zIndex: '9999',
    position: 'absolute',
    top: '600px',
    left: '95%',
    fontSize: '35px',
    textAlign: 'center',
    textShadow: '5px 5px 5px rgb(81 34 165)',
    backgroundImage: 'linear-gradient(141deg,#9fb8ad 0%,#1fc8db 51%,#2cb5e8 75%)',
    cursor: 'pointer',
    transition: 'transform 1s'
  },
  visible: true,
  children: ['R'],
  listener: {
    mouseover: (e) => {
      e.target.style.transform = 'rotate(180deg)';
    },
    mouseout: (e) => {
      e.target.style.transform = 'rotate(0deg)';
    },
    click: (e) => {
      skuDataTableDiv.options.visible = true;
      ramui.options.visible = false;
      skuTable.options.rows = currentData;
    }
  }
});

const app = new RaMuiElement({
  tagName: 'div',
  children: [skuDataTableDiv, ramui],
});

const domListener = () => {
  const host = window.location.host;
  let dom;
  if (host.includes('taobao')) {
    dom = document.getElementById('J_isku');
  } else {
    dom = document.querySelector('.tb-sku');
  }
  const config = { attributes: true, childList: true, subtree: true };
  const callback = (mutationsList) => {
    mutationsList.forEach(item => {
      if (host.includes('taobao')) {
        if (item.target.className === 'tb-count') {
          getValue(observer);
        }
      } else {
        if (item.target.className === 'tb-sku') {
          getValue(observer);
        }
      }

    });
  };
  const observer = new MutationObserver(callback);
  observer.observe(dom, config);
}

(() => {
  'use strict';
  domListener();
})();