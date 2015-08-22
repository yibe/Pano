
XPCOMUtils.defineLazyModuleGetter(this, "PlacesUIUtils", "resource://gre/modules/PlacesUIUtils.jsm");
XPCOMUtils.defineLazyModuleGetter(this, "PageThumbs", "resource://gre/modules/PageThumbs.jsm");
XPCOMUtils.defineLazyGetter(this, "stringBundle", function() {
  return Services.strings.createBundle("chrome://pano/locale/pano-tree.properties");
});

function onDragStart (aEvent) {
  PanoramaTreeView.onDragStart(aEvent, view);
}
function onDragOver (aEvent) {
  PanoramaTreeView.onDragOver(aEvent, view);
}
function onTreeDblClick (aEvent) {
  if (aEvent.button !== 0)
    return;

  var item = view.getItemFromEvent(aEvent);
  if (item === null) {
    aEvent.stopPropagation();
    aEvent.preventDefault();
    newGroup();
  }
}

function selectTab (aEvent) {
  var index = view.selection.currentIndex;
  if (index === -1)
    return;

  var item = view.rows[index];
  if (item.type & TAB_ITEM_TYPE) {
    if (aEvent) {
      aEvent.preventDefault();
      aEvent.stopPropagation();
    }
    if (!item.tab.pinned) {
      let tabItem = item.tab._tabViewTabItem;
      view.tabView._window.UI.setActive(tabItem);
    }
    if (gBrowser.selectedTab !== item.tab) {
      gBrowser.mTabContainer.selectedIndex = item.tab._tPos;
      if (isPanel && Services.prefs.getBoolPref("extensions.pano.panel.autoCloseByTabSelect"))
        panel.hidePopup();
    }
  }
}

function onTreeClick (aEvent) {
  switch (aEvent.button) {
    case 0: { // Left Click
      if (aEvent.ctrlKey || aEvent.shiftKey || aEvent.metaKey || aEvent.altKey)
        return;

      selectTab(aEvent);
    }
    break;
    case 1: { // Middle Click
      let item = view.getItemFromEvent(aEvent);
      if (!item || !(item.type & TAB_ITEM_TYPE)) {
        return;
      }
      let animate = gBrowser.visibleTabs.indexOf(item.tab) >= 0;
      gBrowser.removeTab(item.tab, { animate: animate, byMouse: false });
    }
    break;
    default:
      return;
  }
}

tree.addEventListener("click", onTreeClick, false);
tree.addEventListener("dblclick", onTreeDblClick, false);

const PREF_TOOLTIP_SHOW_THUMBNAIL = "extensions.pano.tooltip.showThumbnail",
      PREF_TOOLTIP_SHOW_TITLE     = "extensions.pano.tooltip.showTitle";

var observer = {
  observe: function (aSubject, aTopic, aData) {
    if (isPanel && aTopic === "lightweight-theme-styling-update") {
      /** @see pano-pane.sub.js */
      updatePanelTheme(JSON.parse(aData));
    }
  },
  QueryInterface: XPCOMUtils.generateQI(["nsIObserver", "nsISupportsWeakReference"]),
}
Services.obs.addObserver(observer, "lightweight-theme-styling-update", true);

function newGroup () {
  view.GI.newGroup().newTab();
  view.gWindow.focusAndSelectUrlBar();
}

function setFilter (aString) {
  view.setFilter(aString ? aString : null);
}

var tooltip = {
  get titleElm () {
    var elm = document.getElementById("panoTreeTooltipTitle");
    delete this.titleElm;
    return this.titleElm = elm;
  },
  get urlElm () {
    var elm = document.getElementById("panoTreeTooltipURL");
    delete this.urlElm;
    return this.urlElm = elm;
  },
  get imageElm () {
    var elm = document.getElementById("panoTreeTooltipImage");
    delete this.imageElm;
    return this.imageElm = elm;
  },
  get showThumbnail () Services.prefs.getBoolPref(PREF_TOOLTIP_SHOW_THUMBNAIL),
  get showTitle () Services.prefs.getBoolPref(PREF_TOOLTIP_SHOW_TITLE),
  build: function buildTooltip (aEvent) {
    aEvent.stopPropagation();
    if (contextMenu.currentItem) {
      aEvent.preventDefault();
      return;
    }
    var item = view.getItemFromEvent(aEvent);
    if (!item || !(item.type & TAB_ITEM_TYPE)) {
      aEvent.preventDefault();
      return;
    }

    if (this.showTitle) {
      this.titleElm.setAttribute("value", item.title);
      this.titleElm.style.removeProperty("visibility");
    } else {
      this.titleElm.style.setProperty("visibility", "collapse", "");
    }
    this.urlElm.setAttribute("value", item.url);

    if (this.showThumbnail) {
      this.titleElm.setAttribute("crop", "center");
      this.urlElm.setAttribute("crop", "center");
      this.imageElm.style.removeProperty("visibility");
      document.mozSetImageElement("panoTabCapture", null);
      var browser = item.tab.linkedBrowser;

      let { width, height } = browser.boxObject;
      let boxWidth = parseInt(window.getComputedStyle(this.imageElm, "").width, 10);
      let boxHeight = Math.round(boxWidth * height / width);
      this.imageElm.style.height = boxHeight + "px";

      if (browser.__SS_restoreState) {
        if (item.tab._tabViewTabItem)
          document.mozSetImageElement("panoTabCapture", item.tab._tabViewTabItem.$cachedThumb[0]);
        else
          this.imageElm.style.setProperty("visibility", "collapse", "");
      } else {
        let canvas = PageThumbs.createCanvas();
        canvas.width = boxWidth;
        canvas.height = boxHeight;
        PageThumbs.captureToCanvas(browser, canvas, function () {
          document.mozSetImageElement("panoTabCapture", canvas);
        });
      }
    } else {
      this.imageElm.style.setProperty("visibility", "collapse", "");
      this.titleElm.removeAttribute("crop");
      this.urlElm.removeAttribute("crop");
    }
  },
};

var contextMenu = {
  get newTabElm () {
    var elm = document.getElementById("panoContextMenu_newTab");
    delete this.newTabElm;
    return this.newTabElm = elm;
  },
  get groupCloseElm () {
    var elm = document.getElementById("panoContextMenu_groupClose");
    delete this.groupCloseElm;
    return this.groupCloseElm = elm;
  },
  get tabCloseElm () {
    var elm = document.getElementById("panoContextMenu_tabClose");
    delete this.tabCloseElm;
    return this.tabCloseElm= elm;
  },
  get hibernateElm () {
    var elm = document.getElementById("panoContextMenu_hibernate");
    delete this.hibernateElm;
    return this.hibernateElm = elm;
  },
  get bookmarksAllTabsElm () {
    var elm = document.getElementById("panoContextMenu_bookmarksAllTabs");
    delete this.bookmarksAllTabsElm;
    return this.bookmarksAllTabsElm = elm;
  },
  get reloadAllTabsElm () {
    var elm = document.getElementById("panoContextMenu_reloadAllTabs");
    delete this.reloadAllTabsElm;
    return this.reloadAllTabsElm = elm;
  },
  get moveToGroupElm () {
    var elm = document.getElementById("panoContextMenu_moveToGroup");
    delete this.moveToGroupElm;
    return this.moveToGroupElm = elm;
  },
  currentItem: null,
  build: function buildContextMenu (aEvent) {
    if (aEvent.target.id !== "panoContextMenu")
      return;

    var item = this.currentItem = view.getItemFromEvent(aEvent);
    if (item) {
      let isTabItem = (item.type & TAB_ITEM_TYPE) > 0;
      let isNormalGroup = item.type === TAB_GROUP_TYPE;
      this.showItem("groupCloseElm",isNormalGroup);
      this.showItem("tabCloseElm", isTabItem);
      this.showItem("newTabElm", isNormalGroup);
      this.showItem("hibernateElm", true);
      this.showItem("bookmarksAllTabsElm", true);
      this.showItem("reloadAllTabsElm", true);
      this.showItem("moveToGroupElm", isTabItem);
    } else {
      this.showItem("hibernateElm", false);
      this.showItem("bookmarksAllTabsElm", false);
      this.showItem("reloadAllTabsElm", false);
      this.showItem("groupCloseElm", false);
      this.showItem("tabCloseElm", false);
      this.showItem("moveToGroupElm", false);
    }
  },
  showItem: function showMenuItem (aID, aShow) {
    this[aID].hidden = !aShow;
  },
  onPopupHiding: function onContextMenuHidden (event) {
    if (event.target.id === "panoContextMenu")
      this.currentItem = null;
  },
  newTab: function newTabFromContextMenu () {
    var item = this.currentItem;
    if (item && item.type === TAB_GROUP_TYPE) {
      item.group.newTab();
      view.gWindow.focusAndSelectUrlBar();
    }
  },
  closeItem: function PT_closeItemFromContextMenu () {
    var item = this.currentItem;
    if (!item)
      return;

    var isTabItem = (item.type & TAB_ITEM_TYPE) > 0;
    var selectedItems = view.getSelectedItems();
    var visibleTabs = gBrowser.visibleTabs;
    var tabs = [], groups = {};

    for (let [, item] in Iterator(selectedItems)) {
      if (item.type & TAB_ITEM_TYPE) {
        let tabItem = item.tab._tabViewTabItem;
        if (tabItem && tabItem.parent && (tabItem.parent.id in groups)) {
          continue;
        } else {
          tabs.push(item);
        }
      } else if (item.type === TAB_GROUP_TYPE) {
        groups[item.id] = item;
      }
    }
    const promptService = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
    const PREF_CONFIRM_CLOSING_GROUP = "extensions.pano.confirm_closing_group";
    for (let [id, item] in Iterator(groups)) {
      let state = {};
      if (Services.prefs.getBoolPref(PREF_CONFIRM_CLOSING_GROUP)) {
        if (promptService.confirmCheck(window,
                                       stringBundle.GetStringFromName("confirm_closing_group.title"),
                                       stringBundle.formatStringFromName("confirm_closing_group.msg", [item.title], 1),
                                       stringBundle.GetStringFromName("confirm_closing_group.checkMsg"),
                                       state))
        {
          if (state.value)
            Services.prefs.setBoolPref(PREF_CONFIRM_CLOSING_GROUP, false);
        } else {
          continue;
        }
      }
      item.group._children.forEach(function(tabItem) {
        gBrowser.removeTab(tabItem.tab, { animate: visibleTabs.indexOf(tabItem.tab) >= 0, byMouse: false });
      });
      item.group.close({ immediately: true });
    }
    tabs.forEach(function(tabItem) {
      gBrowser.removeTab(tabItem.tab, { animate: visibleTabs.indexOf(tabItem.tab) >= 0, byMouse: false });
    });
  },
  hibernate: function PT_hibernate () {
    var items = view.getSelectedItems();
    if (items.length > 0)
      view.hibernateItems(items);
  },
  bookmarksAllTabs: function PT_bookmarksAllTabs () {
    var item = this.currentItem;
    if (!item)
      return;

    var items = view.getSelectedItems();
    var unique = {};
    var tabs = items.reduce(function getTabs(tabList, item) {
      if (item.type & TAB_ITEM_TYPE) {
        let spec = item.tab.linkedBrowser.currentURI.spec;
        if (tabList.indexOf(item.tab) === -1 && !(spec in unique)) {
          unique[spec] = null;
          tabList.push(item.tab);
        }
      } else {
        item.children.forEach(function getTabsInGroup(child) {
          let spec = item.tab.linkedBrowser.currentURI.spec;
          if (tabList.indexOf(child.tab) === -1 && !(spec in unique)) {
            unique[spec] = null;
            tabList.push(child.tab);
          }
        });
      }
      return tabList;
    }, []);

    if (tabs.length == 1)
      window.top.PlacesCommandHook.bookmarkPage(tabs[0].linkedBrowser, window.top.PlacesUtils.bookmarksMenuFolderId, true);
    else if (tabs.length > 1)
      PlacesUIUtils.showMinimalAddMultiBookmarkUI(tabs.map(function(tab) tab.linkedBrowser.currentURI));
  },
  reloadAllTabs: function PT_reloadAllTabs () {
    var item = this.currentItem;
    if (!item)
      return;

    var items = view.getSelectedItems();
    var browsers = items.reduce(function getTabs(bList, item) {
      if (item.type & TAB_ITEM_TYPE) {
        bList.push(item.tab.linkedBrowser);
      } else {
        item.children.forEach(function getTabsInGroup(child) {
          if (bList.indexOf(child.tab.linkedBrowser) === -1)
            bList.push(child.tab.linkedBrowser);
        });
      }
      return bList;
    }, []);
    browsers.forEach(function reloadTab(b) {
      Services.console.logStringMessage("reload: " + b.currentURI.spec);
      b.reload();
    });
  },
  moveToGroupPopupShowing: function (aEvent) {
    let popup = aEvent.target;
    let separator = document.getElementById("panoContextMenu_moveToGroupSep");

    while (popup.firstChild && popup.firstChild != separator)
      popup.removeChild(popup.firstChild);

    let groupItems = view.tabView._window.GroupItems.groupItems;
    for (let groupItem of groupItems) {
      if (groupItem.hidden)
        continue;

      let groupId = groupItem.id;
      let menuItem = document.createElement("menuitem");
      menuItem.addEventListener("command", () => {
        this.moveToGroup(groupId);
      }, false);
      menuItem.setAttribute("label", groupItem.getTitle() || groupId);
      popup.insertBefore(menuItem, separator);
    }
  },
  moveToGroup: function (groupId) {
    let item = this.currentItem;
    if (!item)
      return;

    let selectedItems = view.getSelectedItems();
    let tabs = selectedItems
          .filter(function (item) item.type & TAB_ITEM_TYPE)
          .map(function (item) item.tab);

    if (tabs.length == 0)
      return;

    if (!groupId)
      groupId = view.GI.newGroup().id;

    let selectedTab = null;
    let nextTab = null;
    tabs.forEach(function (tab, index) {
      if (tab.selected && index < tabs.length - 1) {
        selectedTab = tab;
        nextTab = tabs[index + 1];
        return;
      }
      if (tab.pinned)
        gBrowser.unpinTab(tab);
      view.GI.moveTabToGroupItem(tab, groupId);
      gBrowser.moveTabTo(tab, gBrowser.tabs.length - 1);
    });

    if (selectedTab) {
      if (selectedTab.pinned)
        gBrowser.unpinTab(selectedTab);
      view.GI.moveTabToGroupItem(selectedTab, groupId);

      let index = nextTab._tPos;
      if (selectedTab._tPos < index)
        index = index - 1;
      gBrowser.moveTabTo(selectedTab, index);
    }

    view.selection.clearSelection();
  },
  moveToNewGroup: function () {
    this.moveToGroup(null);
  }
};

function expandAll () {
  view.expandAll();
}

function collapseAll (aButOpenCurrentGroup) {
  view.collapseAll(aButOpenCurrentGroup);
}

function closeEmptyGroups () {
  for (let i = 0; i < view.rows.length; ++i) {
    let row = view.rows[i];
    if ((row.type === TAB_GROUP_TYPE) && !row.hasChild)
      row.group.closeHidden();
  }
}

function exportSessions (aFile) {
  view.exportSessions(aFile);
}

function importSessions (aFile) {
  view.importSessions(aFile);
}

// vim: sw=2 ts=2 et:
