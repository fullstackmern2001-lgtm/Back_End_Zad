const ApiError = require("./ApiError");

const isPlainObject = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const invalidQuery = (message) => new ApiError(message, 400);

const parseFilterValue = (field, value, definition) => {
  const parseScalar = (scalar) => {
    if (typeof scalar !== "string") {
      throw invalidQuery(`قيمة الفلتر ${field} غير صالحة`);
    }

    switch (definition.type) {
      case "number": {
        if (!/^-?\d+(?:\.\d+)?$/.test(scalar)) {
          throw invalidQuery(`قيمة الفلتر ${field} يجب أن تكون رقمًا`);
        }
        const number = Number(scalar);
        if (
          !Number.isFinite(number) ||
          (definition.min !== undefined && number < definition.min)
        ) {
          throw invalidQuery(`قيمة الفلتر ${field} خارج النطاق المسموح`);
        }
        return number;
      }
      case "boolean":
        if (scalar !== "true" && scalar !== "false") {
          throw invalidQuery(`قيمة الفلتر ${field} يجب أن تكون true أو false`);
        }
        return scalar === "true";
      case "objectId":
        if (!/^[a-f\d]{24}$/i.test(scalar)) {
          throw invalidQuery(`معرف ${field} غير صالح`);
        }
        return scalar;
      case "date": {
        const date = new Date(scalar);
        if (!Number.isFinite(date.getTime())) {
          throw invalidQuery(`قيمة التاريخ ${field} غير صالحة`);
        }
        return date;
      }
      case "enum":
        if (!definition.values.includes(scalar)) {
          throw invalidQuery(`قيمة الفلتر ${field} غير مسموحة`);
        }
        return scalar;
      default:
        if (
          scalar.length > (definition.maxLength || 100) ||
          (definition.values && !definition.values.includes(scalar))
        ) {
          throw invalidQuery(`قيمة الفلتر ${field} غير صالحة`);
        }
        return scalar;
    }
  };

  if (!isPlainObject(value)) {
    return parseScalar(value);
  }

  const allowedOperators = definition.operators || [];
  const entries = Object.entries(value);
  if (
    entries.length === 0 ||
    entries.some(([operator]) => !allowedOperators.includes(operator))
  ) {
    throw invalidQuery(`عمليات الفلترة غير مسموحة للحقل ${field}`);
  }

  return Object.fromEntries(
    entries.map(([operator, operand]) => [
      `$${operator}`,
      parseScalar(operand),
    ]),
  );
};

const parsePositiveInteger = (value, name, defaultValue, maximum) => {
  if (value === undefined) return defaultValue;
  if (
    typeof value !== "string" ||
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value)) ||
    Number(value) > maximum
  ) {
    throw invalidQuery(`قيمة ${name} يجب أن تكون عددًا صحيحًا بين 1 و${maximum}`);
  }
  return Number(value);
};

class ApiFeatures {
  constructor(mongooseQuery, queryString, options) {
    this.mongooseQuery = mongooseQuery;
    this.queryString = queryString || {};
    this.options = options;
  }

  validateQueryParams() {
    if (!this.options) return this;

    const allowedKeys = new Set(["page", "limit"]);
    if (this.options.sortFields?.length) allowedKeys.add("sort");
    if (this.options.selectFields?.length) allowedKeys.add("fields");
    if (this.options.searchFields?.length) allowedKeys.add("keyword");
    Object.keys(this.options.filterFields || {}).forEach((field) =>
      allowedKeys.add(field),
    );

    for (const key of Object.keys(this.queryString)) {
      if (!allowedKeys.has(key)) {
        throw invalidQuery(`معامل الاستعلام ${key} غير مسموح`);
      }
    }

    if (this.queryString.keyword !== undefined) {
      const { keyword } = this.queryString;
      if (typeof keyword !== "string" || keyword.length > 100) {
        throw invalidQuery("كلمة البحث غير صالحة أو طويلة جدًا");
      }
    }

    if (
      this.queryString.sort !== undefined &&
      typeof this.queryString.sort !== "string"
    ) {
      throw invalidQuery("قيمة الترتيب غير صالحة");
    }
    if (
      this.queryString.fields !== undefined &&
      typeof this.queryString.fields !== "string"
    ) {
      throw invalidQuery("قائمة الحقول غير صالحة");
    }

    const maximumLimit = this.options.maxLimit || 50;
    parsePositiveInteger(
      this.queryString.page,
      "page",
      1,
      this.options.maxPage || 10000,
    );
    parsePositiveInteger(
      this.queryString.limit,
      "limit",
      this.options.defaultLimit || maximumLimit,
      maximumLimit,
    );

    for (const [field, definition] of Object.entries(
      this.options.filterFields || {},
    )) {
      if (this.queryString[field] !== undefined) {
        parseFilterValue(field, this.queryString[field], definition);
      }
    }

    const sortValue =
      this.queryString.sort || this.options.defaultSort || "-createdAt";
    for (const entry of sortValue.split(",")) {
      const field = entry.startsWith("-") ? entry.slice(1) : entry;
      if (!field || !this.options.sortFields.includes(field)) {
        throw invalidQuery(`حقل الترتيب ${field} غير مسموح`);
      }
    }

    if (this.queryString.fields !== undefined) {
      const allowedFields = this.options.selectFields || [];
      const fields = this.queryString.fields.split(",");
      if (
        fields.length === 0 ||
        fields.some((entry) => {
          const field = entry.startsWith("-") ? entry.slice(1) : entry;
          return !field || !allowedFields.includes(field);
        })
      ) {
        throw invalidQuery("تحديد بعض الحقول غير مسموح");
      }
    }

    return this;
  }

  filter() {
    if (this.options) {
      const filters = {};
      for (const [field, definition] of Object.entries(
        this.options.filterFields || {},
      )) {
        if (this.queryString[field] !== undefined) {
          filters[field] = parseFilterValue(
            field,
            this.queryString[field],
            definition,
          );
        }
      }
      this.mongooseQuery = this.mongooseQuery.find(filters);
      return this;
    }

    const queryStringObj = { ...this.queryString };
    const excludesFields = ["page", "sort", "limit", "fields"];
    excludesFields.forEach((field) => delete queryStringObj[field]);
    //المنتجات يلي السعر تاعها اكبر من او يساوي الخمسين{price : {$gte : 50} , ratingAvareg : {$gte : 5}}
    // Apply filtration using [gte, gt, lte, lt]
    let queryStr = JSON.stringify(queryStringObj);
    queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, (match) => `$${match}`);

    this.mongooseQuery = this.mongooseQuery.find(JSON.parse(queryStr));

    return this;
  }

  sort() {
    if (this.options) {
      const { sortFields = [], defaultSort = "-createdAt" } = this.options;
      const sortValue = this.queryString.sort || defaultSort;
      const sortFieldsRequested = sortValue.split(",");
      const sortBy = sortFieldsRequested.map((entry) => {
        const descending = entry.startsWith("-");
        const field = descending ? entry.slice(1) : entry;
        if (!sortFields.includes(field)) {
          throw invalidQuery(`حقل الترتيب ${field} غير مسموح`);
        }
        return descending ? `-${field}` : field;
      });
      this.mongooseQuery = this.mongooseQuery.sort(sortBy.join(" "));
      return this;
    }

    if (this.queryString.sort) {
      const sortBy = this.queryString.sort.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.sort(sortBy);
    } else {
      this.mongooseQuery = this.mongooseQuery.sort("-createdAt");
    }
    return this;
  }

  limitFields() {
    if (this.options) {
      if (this.queryString.fields === undefined) {
        this.mongooseQuery = this.mongooseQuery.select("-__v");
        return this;
      }

      const allowedFields = this.options.selectFields || [];
      const fields = this.queryString.fields.split(",");
      if (
        fields.length === 0 ||
        fields.some((entry) => {
          const field = entry.startsWith("-") ? entry.slice(1) : entry;
          return !field || !allowedFields.includes(field);
        })
      ) {
        throw invalidQuery("تحديد بعض الحقول غير مسموح");
      }
      this.mongooseQuery = this.mongooseQuery.select(fields.join(" "));
      return this;
    }

    if (this.queryString.fields) {
      const fields = this.queryString.fields.split(",").join(" ");
      this.mongooseQuery = this.mongooseQuery.select(fields);
    } else {
      this.mongooseQuery = this.mongooseQuery.select("-__v");
    }
    return this;
  }

  search() {
    if (this.options) {
      const { keyword } = this.queryString;
      const searchFields = this.options.searchFields || [];
      if (!keyword || searchFields.length === 0) return this;

      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      this.mongooseQuery = this.mongooseQuery.find({
        $or: searchFields.map((field) => ({
          [field]: { $regex: escapedKeyword, $options: "i" },
        })),
      });
      return this;
    }

    if (this.queryString.keyword) {
      this.mongooseQuery = this.mongooseQuery.find({
        name: { $regex: this.queryString.keyword, $options: "i" },
      });
    }
    return this;
  }

  paginate(countDocuments) {
    if (this.options) {
      this.validateQueryParams();
      const maximumLimit = this.options.maxLimit || 50;
      const page = parsePositiveInteger(
        this.queryString.page,
        "page",
        1,
        this.options.maxPage || 10000,
      );
      const limit = parsePositiveInteger(
        this.queryString.limit,
        "limit",
        this.options.defaultLimit || maximumLimit,
        maximumLimit,
      );
      const skip = (page - 1) * limit;
      const endIndex = page * limit;
      const pagination = {
        currentPage: page,
        limit,
        numberOfPages: Math.ceil(countDocuments / limit),
      };

      if (endIndex < countDocuments) pagination.next = page + 1;
      if (skip > 0) pagination.prev = page - 1;
      this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);
      this.paginationResult = pagination;
      return this;
    }

    const page = this.queryString.page * 1 || 1;
    const limit = this.queryString.limit * 1 || 50;
    const skip = (page - 1) * limit;
    const endIndex = page * limit;

    // Pagination result
    const pagination = {};
    pagination.currentPage = page;
    pagination.limit = limit;
    pagination.numberOfPages = Math.ceil(countDocuments / limit);

    // next page
    if (endIndex < countDocuments) {
      pagination.next = page + 1;
    }
    if (skip > 0) {
      pagination.prev = page - 1;
    }
    this.mongooseQuery = this.mongooseQuery.skip(skip).limit(limit);

    this.paginationResult = pagination;
    return this;
  }
}

module.exports = ApiFeatures;
