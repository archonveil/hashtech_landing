class ObjectUtils {
  static findDiffKeys(obj1, obj2) {
    if (!obj1 || !obj2) {
      return {};
    }

    return Object.keys(obj1)
      .filter((key) => !obj2.hasOwnProperty(key))
      .reduce((result, current) => {
        result[current] = obj1[current];
        return result;
      }, {});
  }

  static getDiffProps(props, defaultProps) {
    return this.findDiffKeys(props, defaultProps);
  }

  static toFlatCase(str) {
    return str && typeof str === "string"
      ? str.replace(/(-|_)/g, "").toLowerCase()
      : str;
  }

  static isEmpty(value) {
    return (
      value === null ||
      value === undefined ||
      value === "" ||
      (Array.isArray(value) && value.length === 0) ||
      (!(value instanceof Date) &&
        typeof value === "object" &&
        Object.keys(value).length === 0)
    );
  }

  static isNotEmpty(value) {
    return !this.isEmpty(value);
  }

  static isObject(value) {
    return (
      value !== null &&
      typeof value === "object" &&
      value instanceof Object &&
      value.constructor === Object
    );
  }

  static isFunction(value) {
    return typeof value === "function";
  }

  static getItemValue(obj, ...params) {
    return this.isFunction(obj) ? obj(...params) : obj;
  }

  static isString(value) {
    return value !== null && typeof value === "string";
  }

  static getMergedProps(props, defaultProps) {
    return Object.assign({}, defaultProps, props);
  }
}

export const ComponentBase = {
  cProps: undefined,
  cParams: undefined,
  cName: undefined,
  defaultProps: {
    pt: undefined,
    ptOptions: undefined,
    unstyled: false,
  },
  context: {},
  globalCSS: undefined,
  classes: {},
  styles: "",
  extend: (props = {}) => {
    const css = props.css;
    const defaultProps = {
      ...props.defaultProps,
      ...ComponentBase.defaultProps,
    };
    const inlineStyles = {};

    const getProps = (props, context = {}) => {
      ComponentBase.context = context;
      ComponentBase.cProps = props;

      return ObjectUtils.getMergedProps(props, defaultProps);
    };

    const getOtherProps = (props) =>
      ObjectUtils.getDiffProps(props, defaultProps);

    const getPTValue = (
      obj = {},
      key = "",
      params = {},
      searchInDefaultPT = true
    ) => {
      if (obj.hasOwnProperty("pt") && obj.pt !== undefined) {
        obj = obj.pt;
      }

      const originalkey = key;
      const isNetstedParam =
        /./g.test(originalkey) && !!params[originalkey.split(".")[0]];
      const fkey = isNetstedParam
        ? ObjectUtils.toFlatCase(originalkey.split(".")[1])
        : ObjectUtils.toFlatCase(originalkey);
      const hostName =
        params.hostName && ObjectUtils.toFlatCase(params.hostName);
      const componentName =
        hostName ||
        (params.props &&
          params.props.__TYPE &&
          ObjectUtils.toFlatCase(params.props.__TYPE)) ||
        "";
      const isTransition = fkey === "transition";
      const datasetPrefix = "data-pc-";

      const getHostInstance = (pararms) => {
        return pararms?.props
          ? pararms.hostName
            ? pararms.props.__TYPE === pararms.hostName
              ? pararms.props
              : getHostInstance(pararms.parent)
            : pararms.parent
          : undefined;
      };

      const getPropValue = (name) => {
        return params.prop?.[name] || getHostInstance(params)?.[name];
      };

      const { mergeSection = true, mergeProps: useMergeProps = false } =
        getPropValue("ptOptions") || {};

      const getPTClassValue = (...args) => {
        const value = getOptionValue(...args);

        if (Array.isArray(value)) {
          return { className: classNames(...value) };
        }

        if (ObjectUtils.isString(value)) {
          return { classNames: value };
        }

        if (
          value?.hasOwnProperty("className") &&
          Array.isArray(value.className)
        ) {
          return { className: classNames(...value.className) };
        }

        return value;
      };

      const globalPT = searchInDefaultPT
        ? isNetstedParam
          ? _useGlobalPT(getPTClassValue, originalkey, params)
          : _useDefaultPT(getPTClassValue, originalkey, params)
        : undefined;
      const self = isNetstedParam
        ? undefined
        : _usePT(
            _getPT(obj, componentName),
            getPTClassValue,
            originalkey,
            params,
            componentName
          );

      const datasetProps = !isTransition && {
        ...(fkey === "root" && {
          [`${datasetPrefix}name`]:
            params.props && params.props.__parentMetadata
              ? ObjectUtils.toFlatCase(params.props.__TYPE)
              : componentName,
        }),
        [`${datasetPrefix}section`]: fkey,
      };

      return mergeSection || (!mergeSection && self)
        ? useMergeProps
          ? mergeProps(
              [
                globalPT,
                self,
                Object.keys(datasetProps).length ? datasetProps : {},
              ],
              {
                classNameMergeFunction:
                  ComponentBase.context.ptOptions?.classNameMergeFunction,
              }
            )
          : {
              globalPT,
              ...self,
              ...(Object.keys(datasetProps).length ? datasetProps : {}),
            }
        : {
            ...self,
            ...(Object.keys(datasetProps).length ? datasetProps : {}),
          };
    };

    const setMetaData = (metadata = {}) => {
        const { props, state } = metadata;
        const ptm = (key = '', params = {}) => getPTValue((props || {}).pt, key, {...metadata, ...params});
        const ptmo = (obj = {}, key ='', params = {}) => getPTValue(obj, key, params, false);

        const isUnstyled = () => {
            return ComponentBase.context.unstyled || props.unstyled;
        }

        const cx = (key = '', params = {}) => {
            return !isUnstyled() ? getOptionValue(css && css.classes, key, { props, state, ...params}) : undefined;
        }

        const sx = (key = '', params = {}, when = true) => {
            if(when) {
                const self = getOptionValue(css && css.inlineStyles, key, { props, state, ...params});
                const base = getOptionValue(inlineStyles, key, { props, state, ...params});

                return mergeProps([base, self], { classNameMergeFunction : ComponentBase.context.ptOptions?.classNameMergeFunction});
            }

            return undefined;
        }

        return { ptm, ptmo, sx, cx, isUnstyled};
    };

    return {
        getProps,
        getOtherProps,
        setMetaData,
        ...props,
        defaultProps
    }
  },
};

const classNames = (...args) => {
  if (args) {
    let classes = [];

    for (let i = 0; i < args.length; i++) {
      let className = args[i];

      if (!className) {
        continue;
      }

      const type = typeof className;

      if (type === "string" || type === "number") {
        classes.push(className);
      } else if (type === "object") {
        const _classes = Array.isArray(className)
          ? className
          : Object.entries(className).map(([key, value]) =>
              value ? key : null
            );

        classes = _classes.length
          ? classes.concat(_classes.filter((Boolean)))
          : classes;
      }
    }

    return classes.join(" ").trim();
  }
};

const mergeProps = (props, options = {}) => {
  if (!props) return;

  const isFunction = (obj) => typeof obj === "function";

  const { classNameMergeFunction } = options;

  const hasMergeFunction = isFunction(classNameMergeFunction);

  return props.reduce((merged, ps) => {
    if (!ps) return merged;

    for (const key in ps) {
      const value = ps[key];

      if (key === "style") {
        merged.style = { ...merged.style, ...ps.style };
      } else if (key === "className") {
        let newClassName = "";

        if (hasMergeFunction) {
          newClassName = classNameMergeFunction(merged.className, ps.className);
        } else {
          newClassName = [merged.className, ps.className].join(" ").trim();
        }

        merged.className = newClassName || undefined;
      } else if (isFunction(value)) {
        const existingFn = merged[key];

        merged[key] = existingFn
          ? (...args) => {
              existingFn(...args);
              value(...args);
            }
          : value;
      } else {
        merged[key] = value;
      }
    }

    return merged;
  }, {});
};

const getOptionValue = (obj, key = "", params = {}) => {
  const fkeys = String(ObjectUtils.toFlatCase(key)).split(".");
  const fkey = fkeys.shift();
  const matchedPTOption = ObjectUtils.isNotEmpty(obj)
    ? Object.keys(obj).find((k) => ObjectUtils.toFlatCase(k) === fkey)
    : "";

  return fkey
    ? ObjectUtils.isObject(obj)
      ? getOptionValue(
          ObjectUtils.getItemValue(obj[matchedPTOption], params),
          fkeys.join("."),
          params
        )
      : undefined
    : ObjectUtils.getItemValue(obj, params);
};

const _usePT = (pt, callbak, key, params) => {
  const fn = (value) => callbak(value, key, params);

  if (pt?.hasOwnProperty("_usept")) {
    const {
      mergedSection = true,
      mergeProps: useMergeProps = false,
      classNameMergeFunction,
    } = pt._usept || {};
    const originalValue = fn(pt.originalValue);
    const value = fn(pt.value);

    if (originalValue === undefined && value === undefined) {
      return undefined;
    } else if (ObjectUtils.isString(value)) {
      return value;
    } else if (ObjectUtils.isString(originalValue)) {
      return originalValue;
    }

    return mergedSection || (!mergedSection && value)
      ? useMergeProps
        ? mergeProps([originalValue, value], { classNameMergeFunction })
        : { ...originalValue, ...value }
      : value;
  }

  return fn(pt);
};


const _getPT = (pt, key = "", callback) => {
  const _usept = pt?._usept;

  const getValue = (value, checkSameKey) => {
    const _value = callback ? callback(value) : value;
    const _key = ObjectUtils.toFlatCase(key);

    return (
      (checkSameKey
        ? (_key !== ComponentBase?.cName
          ? _value?.[key]
          : undefined)
        : _value?.[key]) ?? _value
    );
  };

  return ObjectUtils.isNotEmpty(_usept)
    ? {
        _usept,
        orgininalValue: getValue(pt.originalValue),
        value: getValue(pt.value),
      }
    : getValue(pt, true);
};

const getGlobalPT = () => {
  return _getPT(ComponentBase.context.pt, undefined, (value) =>
    ObjectUtils.getItemValue(value, ComponentBase.cParams)
  );
};

const getDefaultPT = () => {
  return (
    _getPT(ComponentBase.context.pt, undefined, (value) =>
      getOptionValue(value, ComponentBase.cName, ComponentBase.cParams)
    ) || ObjectUtils.getItemValue(value, ComponentBase.cParams)
  );
};

const _useGlobalPT = (callbak, key, params) => {
  return _usePT(getGlobalPT(), callbak, key, params);
};

const _useDefaultPT = (callback, key, params) => {
  return _usePT(getDefaultPT, callback, key, params);
};
