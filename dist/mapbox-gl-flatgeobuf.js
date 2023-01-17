(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
    typeof define === 'function' && define.amd ? define(factory) :
    (global = global || self, global.mapboxglFlatgeobuf = factory());
}(this, (function () { 'use strict';

    const SIZEOF_INT = 4;
    const FILE_IDENTIFIER_LENGTH = 4;
    const SIZE_PREFIX_LENGTH = 4;

    const int32 = new Int32Array(2);
    const float32 = new Float32Array(int32.buffer);
    const float64 = new Float64Array(int32.buffer);
    const isLittleEndian = new Uint16Array(new Uint8Array([1, 0]).buffer)[0] === 1;

    var Encoding;
    (function (Encoding) {
        Encoding[Encoding["UTF8_BYTES"] = 1] = "UTF8_BYTES";
        Encoding[Encoding["UTF16_STRING"] = 2] = "UTF16_STRING";
    })(Encoding || (Encoding = {}));

    class ByteBuffer {
        /**
         * Create a new ByteBuffer with a given array of bytes (`Uint8Array`)
         */
        constructor(bytes_) {
            this.bytes_ = bytes_;
            this.position_ = 0;
            this.text_decoder_ = new TextDecoder();
        }
        /**
         * Create and allocate a new ByteBuffer with a given size.
         */
        static allocate(byte_size) {
            return new ByteBuffer(new Uint8Array(byte_size));
        }
        clear() {
            this.position_ = 0;
        }
        /**
         * Get the underlying `Uint8Array`.
         */
        bytes() {
            return this.bytes_;
        }
        /**
         * Get the buffer's position.
         */
        position() {
            return this.position_;
        }
        /**
         * Set the buffer's position.
         */
        setPosition(position) {
            this.position_ = position;
        }
        /**
         * Get the buffer's capacity.
         */
        capacity() {
            return this.bytes_.length;
        }
        readInt8(offset) {
            return this.readUint8(offset) << 24 >> 24;
        }
        readUint8(offset) {
            return this.bytes_[offset];
        }
        readInt16(offset) {
            return this.readUint16(offset) << 16 >> 16;
        }
        readUint16(offset) {
            return this.bytes_[offset] | this.bytes_[offset + 1] << 8;
        }
        readInt32(offset) {
            return this.bytes_[offset] | this.bytes_[offset + 1] << 8 | this.bytes_[offset + 2] << 16 | this.bytes_[offset + 3] << 24;
        }
        readUint32(offset) {
            return this.readInt32(offset) >>> 0;
        }
        readInt64(offset) {
            return BigInt.asIntN(64, BigInt(this.readUint32(offset)) + (BigInt(this.readUint32(offset + 4)) << BigInt(32)));
        }
        readUint64(offset) {
            return BigInt.asUintN(64, BigInt(this.readUint32(offset)) + (BigInt(this.readUint32(offset + 4)) << BigInt(32)));
        }
        readFloat32(offset) {
            int32[0] = this.readInt32(offset);
            return float32[0];
        }
        readFloat64(offset) {
            int32[isLittleEndian ? 0 : 1] = this.readInt32(offset);
            int32[isLittleEndian ? 1 : 0] = this.readInt32(offset + 4);
            return float64[0];
        }
        writeInt8(offset, value) {
            this.bytes_[offset] = value;
        }
        writeUint8(offset, value) {
            this.bytes_[offset] = value;
        }
        writeInt16(offset, value) {
            this.bytes_[offset] = value;
            this.bytes_[offset + 1] = value >> 8;
        }
        writeUint16(offset, value) {
            this.bytes_[offset] = value;
            this.bytes_[offset + 1] = value >> 8;
        }
        writeInt32(offset, value) {
            this.bytes_[offset] = value;
            this.bytes_[offset + 1] = value >> 8;
            this.bytes_[offset + 2] = value >> 16;
            this.bytes_[offset + 3] = value >> 24;
        }
        writeUint32(offset, value) {
            this.bytes_[offset] = value;
            this.bytes_[offset + 1] = value >> 8;
            this.bytes_[offset + 2] = value >> 16;
            this.bytes_[offset + 3] = value >> 24;
        }
        writeInt64(offset, value) {
            this.writeInt32(offset, Number(BigInt.asIntN(32, value)));
            this.writeInt32(offset + 4, Number(BigInt.asIntN(32, value >> BigInt(32))));
        }
        writeUint64(offset, value) {
            this.writeUint32(offset, Number(BigInt.asUintN(32, value)));
            this.writeUint32(offset + 4, Number(BigInt.asUintN(32, value >> BigInt(32))));
        }
        writeFloat32(offset, value) {
            float32[0] = value;
            this.writeInt32(offset, int32[0]);
        }
        writeFloat64(offset, value) {
            float64[0] = value;
            this.writeInt32(offset, int32[isLittleEndian ? 0 : 1]);
            this.writeInt32(offset + 4, int32[isLittleEndian ? 1 : 0]);
        }
        /**
         * Return the file identifier.   Behavior is undefined for FlatBuffers whose
         * schema does not include a file_identifier (likely points at padding or the
         * start of a the root vtable).
         */
        getBufferIdentifier() {
            if (this.bytes_.length < this.position_ + SIZEOF_INT +
                FILE_IDENTIFIER_LENGTH) {
                throw new Error('FlatBuffers: ByteBuffer is too short to contain an identifier.');
            }
            let result = "";
            for (let i = 0; i < FILE_IDENTIFIER_LENGTH; i++) {
                result += String.fromCharCode(this.readInt8(this.position_ + SIZEOF_INT + i));
            }
            return result;
        }
        /**
         * Look up a field in the vtable, return an offset into the object, or 0 if the
         * field is not present.
         */
        __offset(bb_pos, vtable_offset) {
            const vtable = bb_pos - this.readInt32(bb_pos);
            return vtable_offset < this.readInt16(vtable) ? this.readInt16(vtable + vtable_offset) : 0;
        }
        /**
         * Initialize any Table-derived type to point to the union at the given offset.
         */
        __union(t, offset) {
            t.bb_pos = offset + this.readInt32(offset);
            t.bb = this;
            return t;
        }
        /**
         * Create a JavaScript string from UTF-8 data stored inside the FlatBuffer.
         * This allocates a new string and converts to wide chars upon each access.
         *
         * To avoid the conversion to string, pass Encoding.UTF8_BYTES as the
         * "optionalEncoding" argument. This is useful for avoiding conversion when
         * the data will just be packaged back up in another FlatBuffer later on.
         *
         * @param offset
         * @param opt_encoding Defaults to UTF16_STRING
         */
        __string(offset, opt_encoding) {
            offset += this.readInt32(offset);
            const length = this.readInt32(offset);
            offset += SIZEOF_INT;
            const utf8bytes = this.bytes_.subarray(offset, offset + length);
            if (opt_encoding === Encoding.UTF8_BYTES)
                return utf8bytes;
            else
                return this.text_decoder_.decode(utf8bytes);
        }
        /**
         * Handle unions that can contain string as its member, if a Table-derived type then initialize it,
         * if a string then return a new one
         *
         * WARNING: strings are immutable in JS so we can't change the string that the user gave us, this
         * makes the behaviour of __union_with_string different compared to __union
         */
        __union_with_string(o, offset) {
            if (typeof o === 'string') {
                return this.__string(offset);
            }
            return this.__union(o, offset);
        }
        /**
         * Retrieve the relative offset stored at "offset"
         */
        __indirect(offset) {
            return offset + this.readInt32(offset);
        }
        /**
         * Get the start of data of a vector whose offset is stored at "offset" in this object.
         */
        __vector(offset) {
            return offset + this.readInt32(offset) + SIZEOF_INT; // data starts after the length
        }
        /**
         * Get the length of a vector whose offset is stored at "offset" in this object.
         */
        __vector_len(offset) {
            return this.readInt32(offset + this.readInt32(offset));
        }
        __has_identifier(ident) {
            if (ident.length != FILE_IDENTIFIER_LENGTH) {
                throw new Error('FlatBuffers: file identifier must be length ' +
                    FILE_IDENTIFIER_LENGTH);
            }
            for (let i = 0; i < FILE_IDENTIFIER_LENGTH; i++) {
                if (ident.charCodeAt(i) != this.readInt8(this.position() + SIZEOF_INT + i)) {
                    return false;
                }
            }
            return true;
        }
        /**
         * A helper function for generating list for obj api
         */
        createScalarList(listAccessor, listLength) {
            const ret = [];
            for (let i = 0; i < listLength; ++i) {
                const val = listAccessor(i);
                if (val !== null) {
                    ret.push(val);
                }
            }
            return ret;
        }
        /**
         * A helper function for generating list for obj api
         * @param listAccessor function that accepts an index and return data at that index
         * @param listLength listLength
         * @param res result list
         */
        createObjList(listAccessor, listLength) {
            const ret = [];
            for (let i = 0; i < listLength; ++i) {
                const val = listAccessor(i);
                if (val !== null) {
                    ret.push(val.unpack());
                }
            }
            return ret;
        }
    }

    var empty = new Uint8Array(0);

    function slice_cancel() {
      return this._source.cancel();
    }

    function concat(a, b) {
      if (!a.length) return b;
      if (!b.length) return a;
      var c = new Uint8Array(a.length + b.length);
      c.set(a);
      c.set(b, a.length);
      return c;
    }

    function slice_read() {
      var that = this, array = that._array.subarray(that._index);
      return that._source.read().then(function(result) {
        that._array = empty;
        that._index = 0;
        return result.done ? (array.length > 0
            ? {done: false, value: array}
            : {done: true, value: undefined})
            : {done: false, value: concat(array, result.value)};
      });
    }

    function slice_slice(length) {
      if ((length |= 0) < 0) throw new Error("invalid length");
      var that = this, index = this._array.length - this._index;

      // If the request fits within the remaining buffer, resolve it immediately.
      if (this._index + length <= this._array.length) {
        return Promise.resolve(this._array.subarray(this._index, this._index += length));
      }

      // Otherwise, read chunks repeatedly until the request is fulfilled.
      var array = new Uint8Array(length);
      array.set(this._array.subarray(this._index));
      return (function read() {
        return that._source.read().then(function(result) {

          // When done, it’s possible the request wasn’t fully fullfilled!
          // If so, the pre-allocated array is too big and needs slicing.
          if (result.done) {
            that._array = empty;
            that._index = 0;
            return index > 0 ? array.subarray(0, index) : null;
          }

          // If this chunk fulfills the request, return the resulting array.
          if (index + result.value.length >= length) {
            that._array = result.value;
            that._index = length - index;
            array.set(result.value.subarray(0, length - index), index);
            return array;
          }

          // Otherwise copy this chunk into the array, then read the next chunk.
          array.set(result.value, index);
          index += result.value.length;
          return read();
        });
      })();
    }

    function slice(source) {
      return typeof source.slice === "function" ? source :
          new SliceSource(typeof source.read === "function" ? source
              : source.getReader());
    }

    function SliceSource(source) {
      this._source = source;
      this._array = empty;
      this._index = 0;
    }

    SliceSource.prototype.read = slice_read;
    SliceSource.prototype.slice = slice_slice;
    SliceSource.prototype.cancel = slice_cancel;

    var ColumnType;
    (function (ColumnType) {
        ColumnType[ColumnType["Byte"] = 0] = "Byte";
        ColumnType[ColumnType["UByte"] = 1] = "UByte";
        ColumnType[ColumnType["Bool"] = 2] = "Bool";
        ColumnType[ColumnType["Short"] = 3] = "Short";
        ColumnType[ColumnType["UShort"] = 4] = "UShort";
        ColumnType[ColumnType["Int"] = 5] = "Int";
        ColumnType[ColumnType["UInt"] = 6] = "UInt";
        ColumnType[ColumnType["Long"] = 7] = "Long";
        ColumnType[ColumnType["ULong"] = 8] = "ULong";
        ColumnType[ColumnType["Float"] = 9] = "Float";
        ColumnType[ColumnType["Double"] = 10] = "Double";
        ColumnType[ColumnType["String"] = 11] = "String";
        ColumnType[ColumnType["Json"] = 12] = "Json";
        ColumnType[ColumnType["DateTime"] = 13] = "DateTime";
        ColumnType[ColumnType["Binary"] = 14] = "Binary";
    })(ColumnType || (ColumnType = {}));

    class Column {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsColumn(bb, obj) {
            return (obj || new Column()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        static getSizePrefixedRootAsColumn(bb, obj) {
            bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
            return (obj || new Column()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        name(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        type() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.readUint8(this.bb_pos + offset) : ColumnType.Byte;
        }
        title(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        description(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        width() {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? this.bb.readInt32(this.bb_pos + offset) : -1;
        }
        precision() {
            const offset = this.bb.__offset(this.bb_pos, 14);
            return offset ? this.bb.readInt32(this.bb_pos + offset) : -1;
        }
        scale() {
            const offset = this.bb.__offset(this.bb_pos, 16);
            return offset ? this.bb.readInt32(this.bb_pos + offset) : -1;
        }
        nullable() {
            const offset = this.bb.__offset(this.bb_pos, 18);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : true;
        }
        unique() {
            const offset = this.bb.__offset(this.bb_pos, 20);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        primaryKey() {
            const offset = this.bb.__offset(this.bb_pos, 22);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        metadata(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 24);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        static startColumn(builder) {
            builder.startObject(11);
        }
        static addName(builder, nameOffset) {
            builder.addFieldOffset(0, nameOffset, 0);
        }
        static addType(builder, type) {
            builder.addFieldInt8(1, type, ColumnType.Byte);
        }
        static addTitle(builder, titleOffset) {
            builder.addFieldOffset(2, titleOffset, 0);
        }
        static addDescription(builder, descriptionOffset) {
            builder.addFieldOffset(3, descriptionOffset, 0);
        }
        static addWidth(builder, width) {
            builder.addFieldInt32(4, width, -1);
        }
        static addPrecision(builder, precision) {
            builder.addFieldInt32(5, precision, -1);
        }
        static addScale(builder, scale) {
            builder.addFieldInt32(6, scale, -1);
        }
        static addNullable(builder, nullable) {
            builder.addFieldInt8(7, +nullable, +true);
        }
        static addUnique(builder, unique) {
            builder.addFieldInt8(8, +unique, +false);
        }
        static addPrimaryKey(builder, primaryKey) {
            builder.addFieldInt8(9, +primaryKey, +false);
        }
        static addMetadata(builder, metadataOffset) {
            builder.addFieldOffset(10, metadataOffset, 0);
        }
        static endColumn(builder) {
            const offset = builder.endObject();
            builder.requiredField(offset, 4);
            return offset;
        }
        static createColumn(builder, nameOffset, type, titleOffset, descriptionOffset, width, precision, scale, nullable, unique, primaryKey, metadataOffset) {
            Column.startColumn(builder);
            Column.addName(builder, nameOffset);
            Column.addType(builder, type);
            Column.addTitle(builder, titleOffset);
            Column.addDescription(builder, descriptionOffset);
            Column.addWidth(builder, width);
            Column.addPrecision(builder, precision);
            Column.addScale(builder, scale);
            Column.addNullable(builder, nullable);
            Column.addUnique(builder, unique);
            Column.addPrimaryKey(builder, primaryKey);
            Column.addMetadata(builder, metadataOffset);
            return Column.endColumn(builder);
        }
    }

    class Crs {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsCrs(bb, obj) {
            return (obj || new Crs()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        static getSizePrefixedRootAsCrs(bb, obj) {
            bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
            return (obj || new Crs()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        org(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        code() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.readInt32(this.bb_pos + offset) : 0;
        }
        name(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        description(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        wkt(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        codeString(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 14);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        static startCrs(builder) {
            builder.startObject(6);
        }
        static addOrg(builder, orgOffset) {
            builder.addFieldOffset(0, orgOffset, 0);
        }
        static addCode(builder, code) {
            builder.addFieldInt32(1, code, 0);
        }
        static addName(builder, nameOffset) {
            builder.addFieldOffset(2, nameOffset, 0);
        }
        static addDescription(builder, descriptionOffset) {
            builder.addFieldOffset(3, descriptionOffset, 0);
        }
        static addWkt(builder, wktOffset) {
            builder.addFieldOffset(4, wktOffset, 0);
        }
        static addCodeString(builder, codeStringOffset) {
            builder.addFieldOffset(5, codeStringOffset, 0);
        }
        static endCrs(builder) {
            const offset = builder.endObject();
            return offset;
        }
        static createCrs(builder, orgOffset, code, nameOffset, descriptionOffset, wktOffset, codeStringOffset) {
            Crs.startCrs(builder);
            Crs.addOrg(builder, orgOffset);
            Crs.addCode(builder, code);
            Crs.addName(builder, nameOffset);
            Crs.addDescription(builder, descriptionOffset);
            Crs.addWkt(builder, wktOffset);
            Crs.addCodeString(builder, codeStringOffset);
            return Crs.endCrs(builder);
        }
    }

    var GeometryType;
    (function (GeometryType) {
        GeometryType[GeometryType["Unknown"] = 0] = "Unknown";
        GeometryType[GeometryType["Point"] = 1] = "Point";
        GeometryType[GeometryType["LineString"] = 2] = "LineString";
        GeometryType[GeometryType["Polygon"] = 3] = "Polygon";
        GeometryType[GeometryType["MultiPoint"] = 4] = "MultiPoint";
        GeometryType[GeometryType["MultiLineString"] = 5] = "MultiLineString";
        GeometryType[GeometryType["MultiPolygon"] = 6] = "MultiPolygon";
        GeometryType[GeometryType["GeometryCollection"] = 7] = "GeometryCollection";
        GeometryType[GeometryType["CircularString"] = 8] = "CircularString";
        GeometryType[GeometryType["CompoundCurve"] = 9] = "CompoundCurve";
        GeometryType[GeometryType["CurvePolygon"] = 10] = "CurvePolygon";
        GeometryType[GeometryType["MultiCurve"] = 11] = "MultiCurve";
        GeometryType[GeometryType["MultiSurface"] = 12] = "MultiSurface";
        GeometryType[GeometryType["Curve"] = 13] = "Curve";
        GeometryType[GeometryType["Surface"] = 14] = "Surface";
        GeometryType[GeometryType["PolyhedralSurface"] = 15] = "PolyhedralSurface";
        GeometryType[GeometryType["TIN"] = 16] = "TIN";
        GeometryType[GeometryType["Triangle"] = 17] = "Triangle";
    })(GeometryType || (GeometryType = {}));

    class Header {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsHeader(bb, obj) {
            return (obj || new Header()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        static getSizePrefixedRootAsHeader(bb, obj) {
            bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
            return (obj || new Header()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        name(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        envelope(index) {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.readFloat64(this.bb.__vector(this.bb_pos + offset) + index * 8) : 0;
        }
        envelopeLength() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        envelopeArray() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? new Float64Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        geometryType() {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.readUint8(this.bb_pos + offset) : GeometryType.Unknown;
        }
        hasZ() {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        hasM() {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        hasT() {
            const offset = this.bb.__offset(this.bb_pos, 14);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        hasTm() {
            const offset = this.bb.__offset(this.bb_pos, 16);
            return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
        }
        columns(index, obj) {
            const offset = this.bb.__offset(this.bb_pos, 18);
            return offset ? (obj || new Column()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
        }
        columnsLength() {
            const offset = this.bb.__offset(this.bb_pos, 18);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        featuresCount() {
            const offset = this.bb.__offset(this.bb_pos, 20);
            return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt('0');
        }
        indexNodeSize() {
            const offset = this.bb.__offset(this.bb_pos, 22);
            return offset ? this.bb.readUint16(this.bb_pos + offset) : 16;
        }
        crs(obj) {
            const offset = this.bb.__offset(this.bb_pos, 24);
            return offset ? (obj || new Crs()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
        }
        title(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 26);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        description(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 28);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        metadata(optionalEncoding) {
            const offset = this.bb.__offset(this.bb_pos, 30);
            return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
        }
        static startHeader(builder) {
            builder.startObject(14);
        }
        static addName(builder, nameOffset) {
            builder.addFieldOffset(0, nameOffset, 0);
        }
        static addEnvelope(builder, envelopeOffset) {
            builder.addFieldOffset(1, envelopeOffset, 0);
        }
        static createEnvelopeVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addFloat64(data[i]);
            }
            return builder.endVector();
        }
        static startEnvelopeVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addGeometryType(builder, geometryType) {
            builder.addFieldInt8(2, geometryType, GeometryType.Unknown);
        }
        static addHasZ(builder, hasZ) {
            builder.addFieldInt8(3, +hasZ, +false);
        }
        static addHasM(builder, hasM) {
            builder.addFieldInt8(4, +hasM, +false);
        }
        static addHasT(builder, hasT) {
            builder.addFieldInt8(5, +hasT, +false);
        }
        static addHasTm(builder, hasTm) {
            builder.addFieldInt8(6, +hasTm, +false);
        }
        static addColumns(builder, columnsOffset) {
            builder.addFieldOffset(7, columnsOffset, 0);
        }
        static createColumnsVector(builder, data) {
            builder.startVector(4, data.length, 4);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addOffset(data[i]);
            }
            return builder.endVector();
        }
        static startColumnsVector(builder, numElems) {
            builder.startVector(4, numElems, 4);
        }
        static addFeaturesCount(builder, featuresCount) {
            builder.addFieldInt64(8, featuresCount, BigInt('0'));
        }
        static addIndexNodeSize(builder, indexNodeSize) {
            builder.addFieldInt16(9, indexNodeSize, 16);
        }
        static addCrs(builder, crsOffset) {
            builder.addFieldOffset(10, crsOffset, 0);
        }
        static addTitle(builder, titleOffset) {
            builder.addFieldOffset(11, titleOffset, 0);
        }
        static addDescription(builder, descriptionOffset) {
            builder.addFieldOffset(12, descriptionOffset, 0);
        }
        static addMetadata(builder, metadataOffset) {
            builder.addFieldOffset(13, metadataOffset, 0);
        }
        static endHeader(builder) {
            const offset = builder.endObject();
            return offset;
        }
        static finishHeaderBuffer(builder, offset) {
            builder.finish(offset);
        }
        static finishSizePrefixedHeaderBuffer(builder, offset) {
            builder.finish(offset, undefined, true);
        }
    }

    class Geometry {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsGeometry(bb, obj) {
            return (obj || new Geometry()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        static getSizePrefixedRootAsGeometry(bb, obj) {
            bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
            return (obj || new Geometry()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        ends(index) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.readUint32(this.bb.__vector(this.bb_pos + offset) + index * 4) : 0;
        }
        endsLength() {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        endsArray() {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? new Uint32Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        xy(index) {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.readFloat64(this.bb.__vector(this.bb_pos + offset) + index * 8) : 0;
        }
        xyLength() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        xyArray() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? new Float64Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        z(index) {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.readFloat64(this.bb.__vector(this.bb_pos + offset) + index * 8) : 0;
        }
        zLength() {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        zArray() {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? new Float64Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        m(index) {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? this.bb.readFloat64(this.bb.__vector(this.bb_pos + offset) + index * 8) : 0;
        }
        mLength() {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        mArray() {
            const offset = this.bb.__offset(this.bb_pos, 10);
            return offset ? new Float64Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        t(index) {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? this.bb.readFloat64(this.bb.__vector(this.bb_pos + offset) + index * 8) : 0;
        }
        tLength() {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        tArray() {
            const offset = this.bb.__offset(this.bb_pos, 12);
            return offset ? new Float64Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        tm(index) {
            const offset = this.bb.__offset(this.bb_pos, 14);
            return offset ? this.bb.readUint64(this.bb.__vector(this.bb_pos + offset) + index * 8) : BigInt(0);
        }
        tmLength() {
            const offset = this.bb.__offset(this.bb_pos, 14);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        type() {
            const offset = this.bb.__offset(this.bb_pos, 16);
            return offset ? this.bb.readUint8(this.bb_pos + offset) : GeometryType.Unknown;
        }
        parts(index, obj) {
            const offset = this.bb.__offset(this.bb_pos, 18);
            return offset ? (obj || new Geometry()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
        }
        partsLength() {
            const offset = this.bb.__offset(this.bb_pos, 18);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        static startGeometry(builder) {
            builder.startObject(8);
        }
        static addEnds(builder, endsOffset) {
            builder.addFieldOffset(0, endsOffset, 0);
        }
        static createEndsVector(builder, data) {
            builder.startVector(4, data.length, 4);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addInt32(data[i]);
            }
            return builder.endVector();
        }
        static startEndsVector(builder, numElems) {
            builder.startVector(4, numElems, 4);
        }
        static addXy(builder, xyOffset) {
            builder.addFieldOffset(1, xyOffset, 0);
        }
        static createXyVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addFloat64(data[i]);
            }
            return builder.endVector();
        }
        static startXyVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addZ(builder, zOffset) {
            builder.addFieldOffset(2, zOffset, 0);
        }
        static createZVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addFloat64(data[i]);
            }
            return builder.endVector();
        }
        static startZVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addM(builder, mOffset) {
            builder.addFieldOffset(3, mOffset, 0);
        }
        static createMVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addFloat64(data[i]);
            }
            return builder.endVector();
        }
        static startMVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addT(builder, tOffset) {
            builder.addFieldOffset(4, tOffset, 0);
        }
        static createTVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addFloat64(data[i]);
            }
            return builder.endVector();
        }
        static startTVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addTm(builder, tmOffset) {
            builder.addFieldOffset(5, tmOffset, 0);
        }
        static createTmVector(builder, data) {
            builder.startVector(8, data.length, 8);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addInt64(data[i]);
            }
            return builder.endVector();
        }
        static startTmVector(builder, numElems) {
            builder.startVector(8, numElems, 8);
        }
        static addType(builder, type) {
            builder.addFieldInt8(6, type, GeometryType.Unknown);
        }
        static addParts(builder, partsOffset) {
            builder.addFieldOffset(7, partsOffset, 0);
        }
        static createPartsVector(builder, data) {
            builder.startVector(4, data.length, 4);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addOffset(data[i]);
            }
            return builder.endVector();
        }
        static startPartsVector(builder, numElems) {
            builder.startVector(4, numElems, 4);
        }
        static endGeometry(builder) {
            const offset = builder.endObject();
            return offset;
        }
        static createGeometry(builder, endsOffset, xyOffset, zOffset, mOffset, tOffset, tmOffset, type, partsOffset) {
            Geometry.startGeometry(builder);
            Geometry.addEnds(builder, endsOffset);
            Geometry.addXy(builder, xyOffset);
            Geometry.addZ(builder, zOffset);
            Geometry.addM(builder, mOffset);
            Geometry.addT(builder, tOffset);
            Geometry.addTm(builder, tmOffset);
            Geometry.addType(builder, type);
            Geometry.addParts(builder, partsOffset);
            return Geometry.endGeometry(builder);
        }
    }

    class Feature {
        constructor() {
            this.bb = null;
            this.bb_pos = 0;
        }
        __init(i, bb) {
            this.bb_pos = i;
            this.bb = bb;
            return this;
        }
        static getRootAsFeature(bb, obj) {
            return (obj || new Feature()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        static getSizePrefixedRootAsFeature(bb, obj) {
            bb.setPosition(bb.position() + SIZE_PREFIX_LENGTH);
            return (obj || new Feature()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
        }
        geometry(obj) {
            const offset = this.bb.__offset(this.bb_pos, 4);
            return offset ? (obj || new Geometry()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
        }
        properties(index) {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.readUint8(this.bb.__vector(this.bb_pos + offset) + index) : 0;
        }
        propertiesLength() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        propertiesArray() {
            const offset = this.bb.__offset(this.bb_pos, 6);
            return offset ? new Uint8Array(this.bb.bytes().buffer, this.bb.bytes().byteOffset + this.bb.__vector(this.bb_pos + offset), this.bb.__vector_len(this.bb_pos + offset)) : null;
        }
        columns(index, obj) {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? (obj || new Column()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
        }
        columnsLength() {
            const offset = this.bb.__offset(this.bb_pos, 8);
            return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
        }
        static startFeature(builder) {
            builder.startObject(3);
        }
        static addGeometry(builder, geometryOffset) {
            builder.addFieldOffset(0, geometryOffset, 0);
        }
        static addProperties(builder, propertiesOffset) {
            builder.addFieldOffset(1, propertiesOffset, 0);
        }
        static createPropertiesVector(builder, data) {
            builder.startVector(1, data.length, 1);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addInt8(data[i]);
            }
            return builder.endVector();
        }
        static startPropertiesVector(builder, numElems) {
            builder.startVector(1, numElems, 1);
        }
        static addColumns(builder, columnsOffset) {
            builder.addFieldOffset(2, columnsOffset, 0);
        }
        static createColumnsVector(builder, data) {
            builder.startVector(4, data.length, 4);
            for (let i = data.length - 1; i >= 0; i--) {
                builder.addOffset(data[i]);
            }
            return builder.endVector();
        }
        static startColumnsVector(builder, numElems) {
            builder.startVector(4, numElems, 4);
        }
        static endFeature(builder) {
            const offset = builder.endObject();
            return offset;
        }
        static finishFeatureBuffer(builder, offset) {
            builder.finish(offset);
        }
        static finishSizePrefixedFeatureBuffer(builder, offset) {
            builder.finish(offset, undefined, true);
        }
        static createFeature(builder, geometryOffset, propertiesOffset, columnsOffset) {
            Feature.startFeature(builder);
            Feature.addGeometry(builder, geometryOffset);
            Feature.addProperties(builder, propertiesOffset);
            Feature.addColumns(builder, columnsOffset);
            return Feature.endFeature(builder);
        }
    }

    function fromByteBuffer(bb) {
        const header = Header.getRootAsHeader(bb);
        const featuresCount = header.featuresCount();
        const indexNodeSize = header.indexNodeSize();
        const columns = [];
        for (let j = 0; j < header.columnsLength(); j++) {
            const column = header.columns(j);
            if (!column)
                throw new Error('Column unexpectedly missing');
            if (!column.name())
                throw new Error('Column name unexpectedly missing');
            columns.push({
                name: column.name(),
                type: column.type(),
                title: column.title(),
                description: column.description(),
                width: column.width(),
                precision: column.precision(),
                scale: column.scale(),
                nullable: column.nullable(),
                unique: column.unique(),
                primary_key: column.primaryKey(),
            });
        }
        const crs = header.crs();
        const crsMeta = crs
            ? {
                org: crs.org(),
                code: crs.code(),
                name: crs.name(),
                description: crs.description(),
                wkt: crs.wkt(),
                code_string: crs.codeString(),
            }
            : null;
        const headerMeta = {
            geometryType: header.geometryType(),
            columns: columns,
            envelope: null,
            featuresCount: Number(featuresCount),
            indexNodeSize: indexNodeSize,
            crs: crsMeta,
            title: header.title(),
            description: header.description(),
            metadata: header.metadata(),
        };
        return headerMeta;
    }

    function pairFlatCoordinates(xy, z) {
        const newArray = [];
        for (let i = 0; i < xy.length; i += 2) {
            const a = [xy[i], xy[i + 1]];
            if (z)
                a.push(z[i >> 1]);
            newArray.push(a);
        }
        return newArray;
    }

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    function parseProperties(feature, columns) {
        const properties = {};
        if (!columns || columns.length === 0)
            return properties;
        const array = feature.propertiesArray();
        if (!array)
            return properties;
        const view = new DataView(array.buffer, array.byteOffset);
        const length = feature.propertiesLength();
        let offset = 0;
        while (offset < length) {
            const i = view.getUint16(offset, true);
            offset += 2;
            const column = columns[i];
            const name = column.name;
            switch (column.type) {
                case ColumnType.Bool: {
                    properties[name] = !!view.getUint8(offset);
                    offset += 1;
                    break;
                }
                case ColumnType.Byte: {
                    properties[name] = view.getInt8(offset);
                    offset += 1;
                    break;
                }
                case ColumnType.UByte: {
                    properties[name] = view.getUint8(offset);
                    offset += 1;
                    break;
                }
                case ColumnType.Short: {
                    properties[name] = view.getInt16(offset, true);
                    offset += 2;
                    break;
                }
                case ColumnType.UShort: {
                    properties[name] = view.getUint16(offset, true);
                    offset += 2;
                    break;
                }
                case ColumnType.Int: {
                    properties[name] = view.getInt32(offset, true);
                    offset += 4;
                    break;
                }
                case ColumnType.UInt: {
                    properties[name] = view.getUint32(offset, true);
                    offset += 4;
                    break;
                }
                case ColumnType.Long: {
                    properties[name] = Number(view.getBigInt64(offset, true));
                    offset += 8;
                    break;
                }
                case ColumnType.ULong: {
                    properties[name] = Number(view.getBigUint64(offset, true));
                    offset += 8;
                    break;
                }
                case ColumnType.Float: {
                    properties[name] = view.getFloat32(offset, true);
                    offset += 4;
                    break;
                }
                case ColumnType.Double: {
                    properties[name] = view.getFloat64(offset, true);
                    offset += 8;
                    break;
                }
                case ColumnType.DateTime:
                case ColumnType.String: {
                    const length = view.getUint32(offset, true);
                    offset += 4;
                    properties[name] = textDecoder.decode(array.subarray(offset, offset + length));
                    offset += length;
                    break;
                }
                case ColumnType.Json: {
                    const length = view.getUint32(offset, true);
                    offset += 4;
                    const str = textDecoder.decode(array.subarray(offset, offset + length));
                    properties[name] = JSON.parse(str);
                    offset += length;
                    break;
                }
                default:
                    throw new Error('Unknown type ' + column.type);
            }
        }
        return properties;
    }

    /// <reference types="./repeater.d.ts" />
    /*! *****************************************************************************
    Copyright (c) Microsoft Corporation.

    Permission to use, copy, modify, and/or distribute this software for any
    purpose with or without fee is hereby granted.

    THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
    REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
    AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
    INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
    LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
    OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
    PERFORMANCE OF THIS SOFTWARE.
    ***************************************************************************** */
    /* global Reflect, Promise */

    var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };

    function __extends(d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    }

    function __awaiter(thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    }

    function __generator(thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
        return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (_) try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
                if (y = 0, t) op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0: case 1: t = op; break;
                    case 4: _.label++; return { value: op[1], done: false };
                    case 5: _.label++; y = op[1]; op = [0]; continue;
                    case 7: op = _.ops.pop(); _.trys.pop(); continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                        if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                        if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                        if (t[2]) _.ops.pop();
                        _.trys.pop(); continue;
                }
                op = body.call(thisArg, _);
            } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
            if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
        }
    }

    function __values(o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    }

    function __await(v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    }

    function __asyncGenerator(thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
        function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    }

    /** An error subclass which is thrown when there are too many pending push or next operations on a single repeater. */
    var RepeaterOverflowError = /** @class */ (function (_super) {
        __extends(RepeaterOverflowError, _super);
        function RepeaterOverflowError(message) {
            var _this = _super.call(this, message) || this;
            Object.defineProperty(_this, "name", {
                value: "RepeaterOverflowError",
                enumerable: false,
            });
            if (typeof Object.setPrototypeOf === "function") {
                Object.setPrototypeOf(_this, _this.constructor.prototype);
            }
            else {
                _this.__proto__ = _this.constructor.prototype;
            }
            if (typeof Error.captureStackTrace === "function") {
                Error.captureStackTrace(_this, _this.constructor);
            }
            return _this;
        }
        return RepeaterOverflowError;
    }(Error));
    /** A buffer which allows you to push a set amount of values to the repeater without pushes waiting or throwing errors. */
    var FixedBuffer = /** @class */ (function () {
        function FixedBuffer(capacity) {
            if (capacity < 0) {
                throw new RangeError("Capacity may not be less than 0");
            }
            this._c = capacity;
            this._q = [];
        }
        Object.defineProperty(FixedBuffer.prototype, "empty", {
            get: function () {
                return this._q.length === 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(FixedBuffer.prototype, "full", {
            get: function () {
                return this._q.length >= this._c;
            },
            enumerable: false,
            configurable: true
        });
        FixedBuffer.prototype.add = function (value) {
            if (this.full) {
                throw new Error("Buffer full");
            }
            else {
                this._q.push(value);
            }
        };
        FixedBuffer.prototype.remove = function () {
            if (this.empty) {
                throw new Error("Buffer empty");
            }
            return this._q.shift();
        };
        return FixedBuffer;
    }());
    // TODO: Use a circular buffer here.
    /** Sliding buffers allow you to push a set amount of values to the repeater without pushes waiting or throwing errors. If the number of values exceeds the capacity set in the constructor, the buffer will discard the earliest values added. */
    var SlidingBuffer = /** @class */ (function () {
        function SlidingBuffer(capacity) {
            if (capacity < 1) {
                throw new RangeError("Capacity may not be less than 1");
            }
            this._c = capacity;
            this._q = [];
        }
        Object.defineProperty(SlidingBuffer.prototype, "empty", {
            get: function () {
                return this._q.length === 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SlidingBuffer.prototype, "full", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        SlidingBuffer.prototype.add = function (value) {
            while (this._q.length >= this._c) {
                this._q.shift();
            }
            this._q.push(value);
        };
        SlidingBuffer.prototype.remove = function () {
            if (this.empty) {
                throw new Error("Buffer empty");
            }
            return this._q.shift();
        };
        return SlidingBuffer;
    }());
    /** Dropping buffers allow you to push a set amount of values to the repeater without the push function waiting or throwing errors. If the number of values exceeds the capacity set in the constructor, the buffer will discard the latest values added. */
    var DroppingBuffer = /** @class */ (function () {
        function DroppingBuffer(capacity) {
            if (capacity < 1) {
                throw new RangeError("Capacity may not be less than 1");
            }
            this._c = capacity;
            this._q = [];
        }
        Object.defineProperty(DroppingBuffer.prototype, "empty", {
            get: function () {
                return this._q.length === 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(DroppingBuffer.prototype, "full", {
            get: function () {
                return false;
            },
            enumerable: false,
            configurable: true
        });
        DroppingBuffer.prototype.add = function (value) {
            if (this._q.length < this._c) {
                this._q.push(value);
            }
        };
        DroppingBuffer.prototype.remove = function () {
            if (this.empty) {
                throw new Error("Buffer empty");
            }
            return this._q.shift();
        };
        return DroppingBuffer;
    }());
    /** Makes sure promise-likes don’t cause unhandled rejections. */
    function swallow(value) {
        if (value != null && typeof value.then === "function") {
            value.then(NOOP, NOOP);
        }
    }
    /*** REPEATER STATES ***/
    /** The following is an enumeration of all possible repeater states. These states are ordered, and a repeater may only advance to higher states. */
    /** The initial state of the repeater. */
    var Initial = 0;
    /** Repeaters advance to this state the first time the next method is called on the repeater. */
    var Started = 1;
    /** Repeaters advance to this state when the stop function is called. */
    var Stopped = 2;
    /** Repeaters advance to this state when there are no values left to be pulled from the repeater. */
    var Done = 3;
    /** Repeaters advance to this state if an error is thrown into the repeater. */
    var Rejected = 4;
    /** The maximum number of push or next operations which may exist on a single repeater. */
    var MAX_QUEUE_LENGTH = 1024;
    var NOOP = function () { };
    /** A helper function used to mimic the behavior of async generators where the final iteration is consumed. */
    function consumeExecution(r) {
        var err = r.err;
        var execution = Promise.resolve(r.execution).then(function (value) {
            if (err != null) {
                throw err;
            }
            return value;
        });
        r.err = undefined;
        r.execution = execution.then(function () { return undefined; }, function () { return undefined; });
        return r.pending === undefined ? execution : r.pending.then(function () { return execution; });
    }
    /** A helper function for building iterations from values. Promises are unwrapped, so that iterations never have their value property set to a promise. */
    function createIteration(r, value) {
        var done = r.state >= Done;
        return Promise.resolve(value).then(function (value) {
            if (!done && r.state >= Rejected) {
                return consumeExecution(r).then(function (value) { return ({
                    value: value,
                    done: true,
                }); });
            }
            return { value: value, done: done };
        });
    }
    /**
     * This function is bound and passed to the executor as the stop argument.
     *
     * Advances state to Stopped.
     */
    function stop(r, err) {
        var e_1, _a;
        if (r.state >= Stopped) {
            return;
        }
        r.state = Stopped;
        r.onnext();
        r.onstop();
        if (r.err == null) {
            r.err = err;
        }
        if (r.pushes.length === 0 &&
            (typeof r.buffer === "undefined" || r.buffer.empty)) {
            finish(r);
        }
        else {
            try {
                for (var _b = __values(r.pushes), _d = _b.next(); !_d.done; _d = _b.next()) {
                    var push_1 = _d.value;
                    push_1.resolve();
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _b.return)) _a.call(_b);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
    }
    /**
     * The difference between stopping a repeater vs finishing a repeater is that stopping a repeater allows next to continue to drain values from the push queue and buffer, while finishing a repeater will clear all pending values and end iteration immediately. Once, a repeater is finished, all iterations will have the done property set to true.
     *
     * Advances state to Done.
     */
    function finish(r) {
        var e_2, _a;
        if (r.state >= Done) {
            return;
        }
        if (r.state < Stopped) {
            stop(r);
        }
        r.state = Done;
        r.buffer = undefined;
        try {
            for (var _b = __values(r.nexts), _d = _b.next(); !_d.done; _d = _b.next()) {
                var next = _d.value;
                var execution = r.pending === undefined
                    ? consumeExecution(r)
                    : r.pending.then(function () { return consumeExecution(r); });
                next.resolve(createIteration(r, execution));
            }
        }
        catch (e_2_1) { e_2 = { error: e_2_1 }; }
        finally {
            try {
                if (_d && !_d.done && (_a = _b.return)) _a.call(_b);
            }
            finally { if (e_2) throw e_2.error; }
        }
        r.pushes = [];
        r.nexts = [];
    }
    /**
     * Called when a promise passed to push rejects, or when a push call is unhandled.
     *
     * Advances state to Rejected.
     */
    function reject(r) {
        if (r.state >= Rejected) {
            return;
        }
        if (r.state < Done) {
            finish(r);
        }
        r.state = Rejected;
    }
    /** This function is bound and passed to the executor as the push argument. */
    function push(r, value) {
        swallow(value);
        if (r.pushes.length >= MAX_QUEUE_LENGTH) {
            throw new RepeaterOverflowError("No more than " + MAX_QUEUE_LENGTH + " pending calls to push are allowed on a single repeater.");
        }
        else if (r.state >= Stopped) {
            return Promise.resolve(undefined);
        }
        var valueP = r.pending === undefined
            ? Promise.resolve(value)
            : r.pending.then(function () { return value; });
        valueP = valueP.catch(function (err) {
            if (r.state < Stopped) {
                r.err = err;
            }
            reject(r);
            return undefined; // void :(
        });
        var nextP;
        if (r.nexts.length) {
            var next_1 = r.nexts.shift();
            next_1.resolve(createIteration(r, valueP));
            if (r.nexts.length) {
                nextP = Promise.resolve(r.nexts[0].value);
            }
            else {
                nextP = new Promise(function (resolve) { return (r.onnext = resolve); });
            }
        }
        else if (typeof r.buffer !== "undefined" && !r.buffer.full) {
            r.buffer.add(valueP);
            nextP = Promise.resolve(undefined);
        }
        else {
            nextP = new Promise(function (resolve) { return r.pushes.push({ resolve: resolve, value: valueP }); });
        }
        // If an error is thrown into the repeater via the next or throw methods, we give the repeater a chance to handle this by rejecting the promise returned from push. If the push call is not immediately handled we throw the next iteration of the repeater.
        // To check that the promise returned from push is floating, we modify the then and catch methods of the returned promise so that they flip the floating flag. The push function actually does not return a promise, because modern engines do not call the then and catch methods on native promises. By making next a plain old javascript object, we ensure that the then and catch methods will be called.
        var floating = true;
        var next = {};
        var unhandled = nextP.catch(function (err) {
            if (floating) {
                throw err;
            }
            return undefined; // void :(
        });
        next.then = function (onfulfilled, onrejected) {
            floating = false;
            return Promise.prototype.then.call(nextP, onfulfilled, onrejected);
        };
        next.catch = function (onrejected) {
            floating = false;
            return Promise.prototype.catch.call(nextP, onrejected);
        };
        next.finally = nextP.finally.bind(nextP);
        r.pending = valueP
            .then(function () { return unhandled; })
            .catch(function (err) {
            r.err = err;
            reject(r);
        });
        return next;
    }
    /**
     * Creates the stop callable promise which is passed to the executor
     */
    function createStop(r) {
        var stop1 = stop.bind(null, r);
        var stopP = new Promise(function (resolve) { return (r.onstop = resolve); });
        stop1.then = stopP.then.bind(stopP);
        stop1.catch = stopP.catch.bind(stopP);
        stop1.finally = stopP.finally.bind(stopP);
        return stop1;
    }
    /**
     * Calls the executor passed into the constructor. This function is called the first time the next method is called on the repeater.
     *
     * Advances state to Started.
     */
    function execute(r) {
        if (r.state >= Started) {
            return;
        }
        r.state = Started;
        var push1 = push.bind(null, r);
        var stop1 = createStop(r);
        r.execution = new Promise(function (resolve) { return resolve(r.executor(push1, stop1)); });
        // TODO: We should consider stopping all repeaters when the executor settles.
        r.execution.catch(function () { return stop(r); });
    }
    var records = new WeakMap();
    // NOTE: While repeaters implement and are assignable to the AsyncGenerator interface, and you can use the types interchangeably, we don’t use typescript’s implements syntax here because this would make supporting earlier versions of typescript trickier. This is because TypeScript version 3.6 changed the iterator types by adding the TReturn and TNext type parameters.
    var Repeater = /** @class */ (function () {
        function Repeater(executor, buffer) {
            records.set(this, {
                executor: executor,
                buffer: buffer,
                err: undefined,
                state: Initial,
                pushes: [],
                nexts: [],
                pending: undefined,
                execution: undefined,
                onnext: NOOP,
                onstop: NOOP,
            });
        }
        Repeater.prototype.next = function (value) {
            swallow(value);
            var r = records.get(this);
            if (r === undefined) {
                throw new Error("WeakMap error");
            }
            if (r.nexts.length >= MAX_QUEUE_LENGTH) {
                throw new RepeaterOverflowError("No more than " + MAX_QUEUE_LENGTH + " pending calls to next are allowed on a single repeater.");
            }
            if (r.state <= Initial) {
                execute(r);
            }
            r.onnext(value);
            if (typeof r.buffer !== "undefined" && !r.buffer.empty) {
                var result = createIteration(r, r.buffer.remove());
                if (r.pushes.length) {
                    var push_2 = r.pushes.shift();
                    r.buffer.add(push_2.value);
                    r.onnext = push_2.resolve;
                }
                return result;
            }
            else if (r.pushes.length) {
                var push_3 = r.pushes.shift();
                r.onnext = push_3.resolve;
                return createIteration(r, push_3.value);
            }
            else if (r.state >= Stopped) {
                finish(r);
                return createIteration(r, consumeExecution(r));
            }
            return new Promise(function (resolve) { return r.nexts.push({ resolve: resolve, value: value }); });
        };
        Repeater.prototype.return = function (value) {
            swallow(value);
            var r = records.get(this);
            if (r === undefined) {
                throw new Error("WeakMap error");
            }
            finish(r);
            // We override the execution because return should always return the value passed in.
            r.execution = Promise.resolve(r.execution).then(function () { return value; });
            return createIteration(r, consumeExecution(r));
        };
        Repeater.prototype.throw = function (err) {
            var r = records.get(this);
            if (r === undefined) {
                throw new Error("WeakMap error");
            }
            if (r.state <= Initial ||
                r.state >= Stopped ||
                (typeof r.buffer !== "undefined" && !r.buffer.empty)) {
                finish(r);
                // If r.err is already set, that mean the repeater has already produced an error, so we throw that error rather than the error passed in, because doing so might be more informative for the caller.
                if (r.err == null) {
                    r.err = err;
                }
                return createIteration(r, consumeExecution(r));
            }
            return this.next(Promise.reject(err));
        };
        Repeater.prototype[Symbol.asyncIterator] = function () {
            return this;
        };
        // TODO: Remove these static methods from the class.
        Repeater.race = race;
        Repeater.merge = merge;
        Repeater.zip = zip;
        Repeater.latest = latest;
        return Repeater;
    }());
    /*** COMBINATOR FUNCTIONS ***/
    // TODO: move these combinators to their own file.
    function getIterators(values, options) {
        var e_3, _a;
        var iters = [];
        var _loop_1 = function (value) {
            if (value != null && typeof value[Symbol.asyncIterator] === "function") {
                iters.push(value[Symbol.asyncIterator]());
            }
            else if (value != null && typeof value[Symbol.iterator] === "function") {
                iters.push(value[Symbol.iterator]());
            }
            else {
                iters.push((function valueToAsyncIterator() {
                    return __asyncGenerator(this, arguments, function valueToAsyncIterator_1() {
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    if (!options.yieldValues) return [3 /*break*/, 3];
                                    return [4 /*yield*/, __await(value)];
                                case 1: return [4 /*yield*/, _a.sent()];
                                case 2:
                                    _a.sent();
                                    _a.label = 3;
                                case 3:
                                    if (!options.returnValues) return [3 /*break*/, 5];
                                    return [4 /*yield*/, __await(value)];
                                case 4: return [2 /*return*/, _a.sent()];
                                case 5: return [2 /*return*/];
                            }
                        });
                    });
                })());
            }
        };
        try {
            for (var values_1 = __values(values), values_1_1 = values_1.next(); !values_1_1.done; values_1_1 = values_1.next()) {
                var value = values_1_1.value;
                _loop_1(value);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (values_1_1 && !values_1_1.done && (_a = values_1.return)) _a.call(values_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return iters;
    }
    // NOTE: whenever you see any variables called `advance` or `advances`, know that it is a hack to get around the fact that `Promise.race` leaks memory. These variables are intended to be set to the resolve function of a promise which is constructed and awaited as an alternative to Promise.race. For more information, see this comment in the Node.js issue tracker: https://github.com/nodejs/node/issues/17469#issuecomment-685216777.
    function race(contenders) {
        var _this = this;
        var iters = getIterators(contenders, { returnValues: true });
        return new Repeater(function (push, stop) { return __awaiter(_this, void 0, void 0, function () {
            var advance, stopped, finalIteration, iteration, i_1, _loop_2;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!iters.length) {
                            stop();
                            return [2 /*return*/];
                        }
                        stopped = false;
                        stop.then(function () {
                            advance();
                            stopped = true;
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 5, 7]);
                        iteration = void 0;
                        i_1 = 0;
                        _loop_2 = function () {
                            var j, iters_1, iters_1_1, iter;
                            var e_4, _a;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        j = i_1;
                                        try {
                                            for (iters_1 = (e_4 = void 0, __values(iters)), iters_1_1 = iters_1.next(); !iters_1_1.done; iters_1_1 = iters_1.next()) {
                                                iter = iters_1_1.value;
                                                Promise.resolve(iter.next()).then(function (iteration) {
                                                    if (iteration.done) {
                                                        stop();
                                                        if (finalIteration === undefined) {
                                                            finalIteration = iteration;
                                                        }
                                                    }
                                                    else if (i_1 === j) {
                                                        // This iterator has won, advance i and resolve the promise.
                                                        i_1++;
                                                        advance(iteration);
                                                    }
                                                }, function (err) { return stop(err); });
                                            }
                                        }
                                        catch (e_4_1) { e_4 = { error: e_4_1 }; }
                                        finally {
                                            try {
                                                if (iters_1_1 && !iters_1_1.done && (_a = iters_1.return)) _a.call(iters_1);
                                            }
                                            finally { if (e_4) throw e_4.error; }
                                        }
                                        return [4 /*yield*/, new Promise(function (resolve) { return (advance = resolve); })];
                                    case 1:
                                        iteration = _b.sent();
                                        if (!(iteration !== undefined)) return [3 /*break*/, 3];
                                        return [4 /*yield*/, push(iteration.value)];
                                    case 2:
                                        _b.sent();
                                        _b.label = 3;
                                    case 3: return [2 /*return*/];
                                }
                            });
                        };
                        _a.label = 2;
                    case 2:
                        if (!!stopped) return [3 /*break*/, 4];
                        return [5 /*yield**/, _loop_2()];
                    case 3:
                        _a.sent();
                        return [3 /*break*/, 2];
                    case 4: return [2 /*return*/, finalIteration && finalIteration.value];
                    case 5:
                        stop();
                        return [4 /*yield*/, Promise.race(iters.map(function (iter) { return iter.return && iter.return(); }))];
                    case 6:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        }); });
    }
    function merge(contenders) {
        var _this = this;
        var iters = getIterators(contenders, { yieldValues: true });
        return new Repeater(function (push, stop) { return __awaiter(_this, void 0, void 0, function () {
            var advances, stopped, finalIteration;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!iters.length) {
                            stop();
                            return [2 /*return*/];
                        }
                        advances = [];
                        stopped = false;
                        stop.then(function () {
                            var e_5, _a;
                            stopped = true;
                            try {
                                for (var advances_1 = __values(advances), advances_1_1 = advances_1.next(); !advances_1_1.done; advances_1_1 = advances_1.next()) {
                                    var advance = advances_1_1.value;
                                    advance();
                                }
                            }
                            catch (e_5_1) { e_5 = { error: e_5_1 }; }
                            finally {
                                try {
                                    if (advances_1_1 && !advances_1_1.done && (_a = advances_1.return)) _a.call(advances_1);
                                }
                                finally { if (e_5) throw e_5.error; }
                            }
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, Promise.all(iters.map(function (iter, i) { return __awaiter(_this, void 0, void 0, function () {
                                var iteration, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, , 6, 9]);
                                            _b.label = 1;
                                        case 1:
                                            if (!!stopped) return [3 /*break*/, 5];
                                            Promise.resolve(iter.next()).then(function (iteration) { return advances[i](iteration); }, function (err) { return stop(err); });
                                            return [4 /*yield*/, new Promise(function (resolve) {
                                                    advances[i] = resolve;
                                                })];
                                        case 2:
                                            iteration = _b.sent();
                                            if (!(iteration !== undefined)) return [3 /*break*/, 4];
                                            if (iteration.done) {
                                                finalIteration = iteration;
                                                return [2 /*return*/];
                                            }
                                            return [4 /*yield*/, push(iteration.value)];
                                        case 3:
                                            _b.sent();
                                            _b.label = 4;
                                        case 4: return [3 /*break*/, 1];
                                        case 5: return [3 /*break*/, 9];
                                        case 6:
                                            _a = iter.return;
                                            if (!_a) return [3 /*break*/, 8];
                                            return [4 /*yield*/, iter.return()];
                                        case 7:
                                            _a = (_b.sent());
                                            _b.label = 8;
                                        case 8:
                                            return [7 /*endfinally*/];
                                        case 9: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, finalIteration && finalIteration.value];
                    case 3:
                        stop();
                        return [7 /*endfinally*/];
                    case 4: return [2 /*return*/];
                }
            });
        }); });
    }
    function zip(contenders) {
        var _this = this;
        var iters = getIterators(contenders, { returnValues: true });
        return new Repeater(function (push, stop) { return __awaiter(_this, void 0, void 0, function () {
            var advance, stopped, iterations, values;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!iters.length) {
                            stop();
                            return [2 /*return*/, []];
                        }
                        stopped = false;
                        stop.then(function () {
                            advance();
                            stopped = true;
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 6, 8]);
                        _a.label = 2;
                    case 2:
                        if (!!stopped) return [3 /*break*/, 5];
                        Promise.all(iters.map(function (iter) { return iter.next(); })).then(function (iterations) { return advance(iterations); }, function (err) { return stop(err); });
                        return [4 /*yield*/, new Promise(function (resolve) { return (advance = resolve); })];
                    case 3:
                        iterations = _a.sent();
                        if (iterations === undefined) {
                            return [2 /*return*/];
                        }
                        values = iterations.map(function (iteration) { return iteration.value; });
                        if (iterations.some(function (iteration) { return iteration.done; })) {
                            return [2 /*return*/, values];
                        }
                        return [4 /*yield*/, push(values)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 2];
                    case 5: return [3 /*break*/, 8];
                    case 6:
                        stop();
                        return [4 /*yield*/, Promise.all(iters.map(function (iter) { return iter.return && iter.return(); }))];
                    case 7:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 8: return [2 /*return*/];
                }
            });
        }); });
    }
    function latest(contenders) {
        var _this = this;
        var iters = getIterators(contenders, {
            yieldValues: true,
            returnValues: true,
        });
        return new Repeater(function (push, stop) { return __awaiter(_this, void 0, void 0, function () {
            var advance, advances, stopped, iterations_1, values_2;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!iters.length) {
                            stop();
                            return [2 /*return*/, []];
                        }
                        advances = [];
                        stopped = false;
                        stop.then(function () {
                            var e_6, _a;
                            advance();
                            try {
                                for (var advances_2 = __values(advances), advances_2_1 = advances_2.next(); !advances_2_1.done; advances_2_1 = advances_2.next()) {
                                    var advance1 = advances_2_1.value;
                                    advance1();
                                }
                            }
                            catch (e_6_1) { e_6 = { error: e_6_1 }; }
                            finally {
                                try {
                                    if (advances_2_1 && !advances_2_1.done && (_a = advances_2.return)) _a.call(advances_2);
                                }
                                finally { if (e_6) throw e_6.error; }
                            }
                            stopped = true;
                        });
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 5, 7]);
                        Promise.all(iters.map(function (iter) { return iter.next(); })).then(function (iterations) { return advance(iterations); }, function (err) { return stop(err); });
                        return [4 /*yield*/, new Promise(function (resolve) { return (advance = resolve); })];
                    case 2:
                        iterations_1 = _a.sent();
                        if (iterations_1 === undefined) {
                            return [2 /*return*/];
                        }
                        values_2 = iterations_1.map(function (iteration) { return iteration.value; });
                        if (iterations_1.every(function (iteration) { return iteration.done; })) {
                            return [2 /*return*/, values_2];
                        }
                        // We continuously yield and mutate the same values array so we shallow copy it each time it is pushed.
                        return [4 /*yield*/, push(values_2.slice())];
                    case 3:
                        // We continuously yield and mutate the same values array so we shallow copy it each time it is pushed.
                        _a.sent();
                        return [4 /*yield*/, Promise.all(iters.map(function (iter, i) { return __awaiter(_this, void 0, void 0, function () {
                                var iteration;
                                return __generator(this, function (_a) {
                                    switch (_a.label) {
                                        case 0:
                                            if (iterations_1[i].done) {
                                                return [2 /*return*/, iterations_1[i].value];
                                            }
                                            _a.label = 1;
                                        case 1:
                                            if (!!stopped) return [3 /*break*/, 4];
                                            Promise.resolve(iter.next()).then(function (iteration) { return advances[i](iteration); }, function (err) { return stop(err); });
                                            return [4 /*yield*/, new Promise(function (resolve) { return (advances[i] = resolve); })];
                                        case 2:
                                            iteration = _a.sent();
                                            if (iteration === undefined) {
                                                return [2 /*return*/, iterations_1[i].value];
                                            }
                                            else if (iteration.done) {
                                                return [2 /*return*/, iteration.value];
                                            }
                                            values_2[i] = iteration.value;
                                            return [4 /*yield*/, push(values_2.slice())];
                                        case 3:
                                            _a.sent();
                                            return [3 /*break*/, 1];
                                        case 4: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 4: return [2 /*return*/, _a.sent()];
                    case 5:
                        stop();
                        return [4 /*yield*/, Promise.all(iters.map(function (iter) { return iter.return && iter.return(); }))];
                    case 6:
                        _a.sent();
                        return [7 /*endfinally*/];
                    case 7: return [2 /*return*/];
                }
            });
        }); });
    }

    class Config {
        constructor() {
            this._extraRequestThreshold = 256 * 1024;
        }
        extraRequestThreshold() {
            return this._extraRequestThreshold;
        }
        setExtraRequestThreshold(bytes) {
            if (bytes < 0) {
                throw new Error('extraRequestThreshold cannot be negative');
            }
            this._extraRequestThreshold = bytes;
        }
    }
    Config.global = new Config();

    var LogLevel;
    (function (LogLevel) {
        LogLevel[LogLevel["Debug"] = 0] = "Debug";
        LogLevel[LogLevel["Info"] = 1] = "Info";
        LogLevel[LogLevel["Warn"] = 2] = "Warn";
        LogLevel[LogLevel["Error"] = 3] = "Error";
    })(LogLevel || (LogLevel = {}));
    class Logger {
        static debug(...args) {
            this.log(LogLevel.Debug, ...args);
        }
        static info(...args) {
            this.log(LogLevel.Info, ...args);
        }
        static warn(...args) {
            this.log(LogLevel.Warn, ...args);
        }
        static error(...args) {
            this.log(LogLevel.Error, ...args);
        }
        static log(level, ...args) {
            if (this.logLevel > level) {
                return;
            }
            switch (level) {
                case LogLevel.Debug: {
                    console.debug(...args);
                    break;
                }
                case LogLevel.Info: {
                    console.info(...args);
                    break;
                }
                case LogLevel.Warn: {
                    console.warn(...args);
                    break;
                }
                case LogLevel.Error: {
                    console.error(...args);
                    break;
                }
            }
        }
    }
    Logger.logLevel = LogLevel.Warn;

    const NODE_ITEM_LEN = 8 * 4 + 8;
    const DEFAULT_NODE_SIZE = 16;
    function calcTreeSize(numItems, nodeSize) {
        nodeSize = Math.min(Math.max(+nodeSize, 2), 65535);
        let n = numItems;
        let numNodes = n;
        do {
            n = Math.ceil(n / nodeSize);
            numNodes += n;
        } while (n !== 1);
        return numNodes * NODE_ITEM_LEN;
    }
    function generateLevelBounds(numItems, nodeSize) {
        if (nodeSize < 2)
            throw new Error('Node size must be at least 2');
        if (numItems === 0)
            throw new Error('Number of items must be greater than 0');
        let n = numItems;
        let numNodes = n;
        const levelNumNodes = [n];
        do {
            n = Math.ceil(n / nodeSize);
            numNodes += n;
            levelNumNodes.push(n);
        } while (n !== 1);
        const levelOffsets = [];
        n = numNodes;
        for (const size of levelNumNodes) {
            levelOffsets.push(n - size);
            n -= size;
        }
        const levelBounds = [];
        for (let i = 0; i < levelNumNodes.length; i++)
            levelBounds.push([levelOffsets[i], levelOffsets[i] + levelNumNodes[i]]);
        return levelBounds;
    }
    async function* streamSearch(numItems, nodeSize, rect, readNode) {
        class NodeRange {
            constructor(nodes, level) {
                this._level = level;
                this.nodes = nodes;
            }
            level() {
                return this._level;
            }
            startNode() {
                return this.nodes[0];
            }
            endNode() {
                return this.nodes[1];
            }
            extendEndNodeToNewOffset(newOffset) {
                console.assert(newOffset > this.nodes[1]);
                this.nodes[1] = newOffset;
            }
            toString() {
                return `[NodeRange level: ${this._level}, nodes: ${this.nodes[0]}-${this.nodes[1]}]`;
            }
        }
        const { minX, minY, maxX, maxY } = rect;
        Logger.info(`tree items: ${numItems}, nodeSize: ${nodeSize}`);
        const levelBounds = generateLevelBounds(numItems, nodeSize);
        const leafNodesOffset = levelBounds[0][0];
        const rootNodeRange = (() => {
            const range = [0, 1];
            const level = levelBounds.length - 1;
            return new NodeRange(range, level);
        })();
        const queue = [rootNodeRange];
        Logger.debug(`starting stream search with queue: ${queue}, numItems: ${numItems}, nodeSize: ${nodeSize}, levelBounds: ${levelBounds}`);
        while (queue.length != 0) {
            const nodeRange = queue.shift();
            Logger.debug(`popped node: ${nodeRange}, queueLength: ${queue.length}`);
            const nodeIndex = nodeRange.startNode();
            const isLeafNode = nodeIndex >= leafNodesOffset;
            const [, levelBound] = levelBounds[nodeRange.level()];
            const end = Math.min(nodeRange.endNode() + nodeSize, levelBound);
            const length = end - nodeIndex;
            const buffer = await readNode(nodeIndex * NODE_ITEM_LEN, length * NODE_ITEM_LEN);
            const float64Array = new Float64Array(buffer);
            const uint32Array = new Uint32Array(buffer);
            for (let pos = nodeIndex; pos < end; pos++) {
                const nodePos = (pos - nodeIndex) * 5;
                if (maxX < float64Array[nodePos + 0])
                    continue;
                if (maxY < float64Array[nodePos + 1])
                    continue;
                if (minX > float64Array[nodePos + 2])
                    continue;
                if (minY > float64Array[nodePos + 3])
                    continue;
                const low32Offset = uint32Array[(nodePos << 1) + 8];
                const high32Offset = uint32Array[(nodePos << 1) + 9];
                const offset = readUint52(high32Offset, low32Offset);
                if (isLeafNode) {
                    const featureLength = (() => {
                        if (pos < numItems - 1) {
                            const nextPos = (pos - nodeIndex + 1) * 5;
                            const low32Offset = uint32Array[(nextPos << 1) + 8];
                            const high32Offset = uint32Array[(nextPos << 1) + 9];
                            const nextOffset = readUint52(high32Offset, low32Offset);
                            return nextOffset - offset;
                        }
                        else {
                            return null;
                        }
                    })();
                    yield [offset, pos - leafNodesOffset, featureLength];
                    continue;
                }
                const extraRequestThresholdNodes = Config.global.extraRequestThreshold() / NODE_ITEM_LEN;
                const nearestNodeRange = queue[queue.length - 1];
                if (nearestNodeRange !== undefined &&
                    nearestNodeRange.level() == nodeRange.level() - 1 &&
                    offset < nearestNodeRange.endNode() + extraRequestThresholdNodes) {
                    Logger.debug(`Merging "nodeRange" request into existing range: ${nearestNodeRange}, newOffset: ${nearestNodeRange.endNode()} -> ${offset}`);
                    nearestNodeRange.extendEndNodeToNewOffset(offset);
                    continue;
                }
                const newNodeRange = (() => {
                    const level = nodeRange.level() - 1;
                    const range = [offset, offset + 1];
                    return new NodeRange(range, level);
                })();
                if (nearestNodeRange !== undefined &&
                    nearestNodeRange.level() == newNodeRange.level()) {
                    Logger.info(`Same level, but too far away. Pushing new request at offset: ${offset} rather than merging with distant ${nearestNodeRange}`);
                }
                else {
                    Logger.info(`Pushing new level for ${newNodeRange} onto queue with nearestNodeRange: ${nearestNodeRange} since there's not already a range for this level.`);
                }
                queue.push(newNodeRange);
            }
        }
    }
    function readUint52(high32Bits, low32Bits) {
        if ((high32Bits & 0xfff00000) != 0) {
            throw Error('integer is too large to be safely represented');
        }
        const result = low32Bits + high32Bits * 2 ** 32;
        return result;
    }

    const magicbytes = new Uint8Array([
        0x66, 0x67, 0x62, 0x03, 0x66, 0x67, 0x62, 0x00,
    ]);
    const SIZE_PREFIX_LEN = 4;

    class HttpReader {
        constructor(headerClient, header, headerLength, indexLength) {
            this.headerClient = headerClient;
            this.header = header;
            this.headerLength = headerLength;
            this.indexLength = indexLength;
        }
        static async open(url) {
            const assumedHeaderLength = 2024;
            const headerClient = new BufferedHttpRangeClient(url);
            const assumedIndexLength = (() => {
                const assumedBranchingFactor = DEFAULT_NODE_SIZE;
                const prefetchedLayers = 3;
                let result = 0;
                let i;
                for (i = 0; i < prefetchedLayers; i++) {
                    const layer_width = assumedBranchingFactor ** i * NODE_ITEM_LEN;
                    result += layer_width;
                }
                return result;
            })();
            const minReqLength = assumedHeaderLength + assumedIndexLength;
            Logger.debug(`fetching header. minReqLength: ${minReqLength} (assumedHeaderLength: ${assumedHeaderLength}, assumedIndexLength: ${assumedIndexLength})`);
            {
                const bytes = new Uint8Array(await headerClient.getRange(0, 8, minReqLength, 'header'));
                if (!bytes.subarray(0, 3).every((v, i) => magicbytes[i] === v)) {
                    Logger.error(`bytes: ${bytes} != ${magicbytes}`);
                    throw new Error('Not a FlatGeobuf file');
                }
                Logger.debug('magic bytes look good');
            }
            let headerLength;
            {
                const bytes = await headerClient.getRange(8, 4, minReqLength, 'header');
                headerLength = new DataView(bytes).getUint32(0, true);
                const HEADER_MAX_BUFFER_SIZE = 1048576 * 10;
                if (headerLength > HEADER_MAX_BUFFER_SIZE || headerLength < 8) {
                    throw new Error('Invalid header size');
                }
                Logger.debug(`headerLength: ${headerLength}`);
            }
            const bytes = await headerClient.getRange(12, headerLength, minReqLength, 'header');
            const bb = new ByteBuffer(new Uint8Array(bytes));
            const header = fromByteBuffer(bb);
            const indexLength = calcTreeSize(header.featuresCount, header.indexNodeSize);
            Logger.debug('completed: opening http reader');
            return new HttpReader(headerClient, header, headerLength, indexLength);
        }
        async *selectBbox(rect) {
            const lengthBeforeTree = this.lengthBeforeTree();
            const bufferedClient = this.headerClient;
            const readNode = async function (offsetIntoTree, size) {
                const minReqLength = 0;
                return bufferedClient.getRange(lengthBeforeTree + offsetIntoTree, size, minReqLength, 'index');
            };
            const batches = [];
            let currentBatch = [];
            for await (const searchResult of streamSearch(this.header.featuresCount, this.header.indexNodeSize, rect, readNode)) {
                const [featureOffset, ,] = searchResult;
                let [, , featureLength] = searchResult;
                if (!featureLength) {
                    Logger.info('final feature');
                    const guessLength = Config.global.extraRequestThreshold();
                    featureLength = guessLength;
                }
                if (currentBatch.length == 0) {
                    currentBatch.push([featureOffset, featureLength]);
                    continue;
                }
                const prevFeature = currentBatch[currentBatch.length - 1];
                const gap = featureOffset - (prevFeature[0] + prevFeature[1]);
                if (gap > Config.global.extraRequestThreshold()) {
                    Logger.info(`Pushing new feature batch, since gap ${gap} was too large`);
                    batches.push(currentBatch);
                    currentBatch = [];
                }
                currentBatch.push([featureOffset, featureLength]);
            }
            this.headerClient.logUsage('header+index');
            if (currentBatch.length > 0) {
                batches.push(currentBatch);
            }
            const promises = batches.flatMap((batch) => this.readFeatureBatch(batch));
            yield* Repeater.merge(promises);
        }
        lengthBeforeTree() {
            return magicbytes.length + SIZE_PREFIX_LEN + this.headerLength;
        }
        lengthBeforeFeatures() {
            return this.lengthBeforeTree() + this.indexLength;
        }
        buildFeatureClient() {
            return new BufferedHttpRangeClient(this.headerClient.httpClient);
        }
        async *readFeatureBatch(batch) {
            const [firstFeatureOffset] = batch[0];
            const [lastFeatureOffset, lastFeatureLength] = batch[batch.length - 1];
            const batchStart = firstFeatureOffset;
            const batchEnd = lastFeatureOffset + lastFeatureLength;
            const batchSize = batchEnd - batchStart;
            const featureClient = this.buildFeatureClient();
            for (const [featureOffset] of batch) {
                yield await this.readFeature(featureClient, featureOffset, batchSize);
            }
            featureClient.logUsage('feature');
        }
        async readFeature(featureClient, featureOffset, minFeatureReqLength) {
            const offset = featureOffset + this.lengthBeforeFeatures();
            let featureLength;
            {
                const bytes = await featureClient.getRange(offset, 4, minFeatureReqLength, 'feature length');
                featureLength = new DataView(bytes).getUint32(0, true);
            }
            const byteBuffer = await featureClient.getRange(offset + 4, featureLength, minFeatureReqLength, 'feature data');
            const bytes = new Uint8Array(byteBuffer);
            const bytesAligned = new Uint8Array(featureLength + SIZE_PREFIX_LEN);
            bytesAligned.set(bytes, SIZE_PREFIX_LEN);
            const bb = new ByteBuffer(bytesAligned);
            bb.setPosition(SIZE_PREFIX_LEN);
            return Feature.getRootAsFeature(bb);
        }
    }
    class BufferedHttpRangeClient {
        constructor(source) {
            this.bytesEverUsed = 0;
            this.bytesEverFetched = 0;
            this.buffer = new ArrayBuffer(0);
            this.head = 0;
            if (typeof source === 'string') {
                this.httpClient = new HttpRangeClient(source);
            }
            else {
                this.httpClient = source;
            }
        }
        async getRange(start, length, minReqLength, purpose) {
            this.bytesEverUsed += length;
            const start_i = start - this.head;
            const end_i = start_i + length;
            if (start_i >= 0 && end_i <= this.buffer.byteLength) {
                return this.buffer.slice(start_i, end_i);
            }
            const lengthToFetch = Math.max(length, minReqLength);
            this.bytesEverFetched += lengthToFetch;
            Logger.debug(`requesting for new Range: ${start}-${start + length - 1}`);
            this.buffer = await this.httpClient.getRange(start, lengthToFetch, purpose);
            this.head = start;
            return this.buffer.slice(0, length);
        }
        logUsage(purpose) {
            const category = purpose.split(' ')[0];
            const used = this.bytesEverUsed;
            const requested = this.bytesEverFetched;
            const efficiency = ((100.0 * used) / requested).toFixed(2);
            Logger.info(`${category} bytes used/requested: ${used} / ${requested} = ${efficiency}%`);
        }
    }
    class HttpRangeClient {
        constructor(url) {
            this.requestsEverMade = 0;
            this.bytesEverRequested = 0;
            this.url = url;
        }
        async getRange(begin, length, purpose) {
            this.requestsEverMade += 1;
            this.bytesEverRequested += length;
            const range = `bytes=${begin}-${begin + length - 1}`;
            Logger.info(`request: #${this.requestsEverMade}, purpose: ${purpose}), bytes: (this_request: ${length}, ever: ${this.bytesEverRequested}), Range: ${range}`);
            const response = await fetch(this.url, {
                headers: {
                    Range: range,
                },
            });
            return response.arrayBuffer();
        }
    }

    function deserialize(bytes, fromFeature, headerMetaFn) {
        if (!bytes.subarray(0, 3).every((v, i) => magicbytes[i] === v))
            throw new Error('Not a FlatGeobuf file');
        const bb = new ByteBuffer(bytes);
        const headerLength = bb.readUint32(magicbytes.length);
        bb.setPosition(magicbytes.length + SIZE_PREFIX_LEN);
        const headerMeta = fromByteBuffer(bb);
        if (headerMetaFn)
            headerMetaFn(headerMeta);
        let offset = magicbytes.length + SIZE_PREFIX_LEN + headerLength;
        const { indexNodeSize, featuresCount } = headerMeta;
        if (indexNodeSize > 0)
            offset += calcTreeSize(featuresCount, indexNodeSize);
        const features = [];
        while (offset < bb.capacity()) {
            const featureLength = bb.readUint32(offset);
            bb.setPosition(offset + SIZE_PREFIX_LEN);
            const feature = Feature.getRootAsFeature(bb);
            features.push(fromFeature(feature, headerMeta));
            offset += SIZE_PREFIX_LEN + featureLength;
        }
        return features;
    }
    async function* deserializeStream(stream, fromFeature, headerMetaFn) {
        const reader = slice(stream);
        const read = async (size) => await reader.slice(size);
        let bytes = new Uint8Array(await read(8));
        if (!bytes.subarray(0, 3).every((v, i) => magicbytes[i] === v))
            throw new Error('Not a FlatGeobuf file');
        bytes = new Uint8Array(await read(4));
        let bb = new ByteBuffer(bytes);
        const headerLength = bb.readUint32(0);
        bytes = new Uint8Array(await read(headerLength));
        bb = new ByteBuffer(bytes);
        const headerMeta = fromByteBuffer(bb);
        if (headerMetaFn)
            headerMetaFn(headerMeta);
        const { indexNodeSize, featuresCount } = headerMeta;
        if (indexNodeSize > 0) {
            const treeSize = calcTreeSize(featuresCount, indexNodeSize);
            await read(treeSize);
        }
        let feature;
        while ((feature = await readFeature(read, headerMeta, fromFeature)))
            yield feature;
    }
    async function* deserializeFiltered(url, rect, fromFeature, headerMetaFn) {
        const reader = await HttpReader.open(url);
        Logger.debug('opened reader');
        if (headerMetaFn)
            headerMetaFn(reader.header);
        for await (const feature of reader.selectBbox(rect)) {
            yield fromFeature(feature, reader.header);
        }
    }
    async function readFeature(read, headerMeta, fromFeature) {
        let bytes = new Uint8Array(await read(4, 'feature length'));
        if (bytes.byteLength === 0)
            return;
        let bb = new ByteBuffer(bytes);
        const featureLength = bb.readUint32(0);
        bytes = new Uint8Array(await read(featureLength, 'feature data'));
        const bytesAligned = new Uint8Array(featureLength + 4);
        bytesAligned.set(bytes, 4);
        bb = new ByteBuffer(bytesAligned);
        bb.setPosition(SIZE_PREFIX_LEN);
        const feature = Feature.getRootAsFeature(bb);
        return fromFeature(feature, headerMeta);
    }

    /**
     * @module ol/events/Event
     */

    /**
     * @classdesc
     * Stripped down implementation of the W3C DOM Level 2 Event interface.
     * See https://www.w3.org/TR/DOM-Level-2-Events/events.html#Events-interface.
     *
     * This implementation only provides `type` and `target` properties, and
     * `stopPropagation` and `preventDefault` methods. It is meant as base class
     * for higher level events defined in the library, and works with
     * {@link module:ol/events/Target~Target}.
     */
    class BaseEvent {
      /**
       * @param {string} type Type.
       */
      constructor(type) {
        /**
         * @type {boolean}
         */
        this.propagationStopped;

        /**
         * @type {boolean}
         */
        this.defaultPrevented;

        /**
         * The event type.
         * @type {string}
         * @api
         */
        this.type = type;

        /**
         * The event target.
         * @type {Object}
         * @api
         */
        this.target = null;
      }

      /**
       * Prevent default. This means that no emulated `click`, `singleclick` or `doubleclick` events
       * will be fired.
       * @api
       */
      preventDefault() {
        this.defaultPrevented = true;
      }

      /**
       * Stop event propagation.
       * @api
       */
      stopPropagation() {
        this.propagationStopped = true;
      }
    }

    /**
     * @module ol/Disposable
     */

    /**
     * @classdesc
     * Objects that need to clean up after themselves.
     */
    class Disposable {
      constructor() {
        /**
         * The object has already been disposed.
         * @type {boolean}
         * @protected
         */
        this.disposed = false;
      }

      /**
       * Clean up.
       */
      dispose() {
        if (!this.disposed) {
          this.disposed = true;
          this.disposeInternal();
        }
      }

      /**
       * Extension point for disposable objects.
       * @protected
       */
      disposeInternal() {}
    }

    /**
     * @module ol/functions
     */

    /**
     * A reusable function, used e.g. as a default for callbacks.
     *
     * @return {void} Nothing.
     */
    function VOID() {}

    /**
     * @module ol/obj
     */

    /**
     * Removes all properties from an object.
     * @param {Object} object The object to clear.
     */
    function clear(object) {
      for (const property in object) {
        delete object[property];
      }
    }

    /**
     * @module ol/events/Target
     */

    /**
     * @typedef {EventTarget|Target} EventTargetLike
     */

    /**
     * @classdesc
     * A simplified implementation of the W3C DOM Level 2 EventTarget interface.
     * See https://www.w3.org/TR/2000/REC-DOM-Level-2-Events-20001113/events.html#Events-EventTarget.
     *
     * There are two important simplifications compared to the specification:
     *
     * 1. The handling of `useCapture` in `addEventListener` and
     *    `removeEventListener`. There is no real capture model.
     * 2. The handling of `stopPropagation` and `preventDefault` on `dispatchEvent`.
     *    There is no event target hierarchy. When a listener calls
     *    `stopPropagation` or `preventDefault` on an event object, it means that no
     *    more listeners after this one will be called. Same as when the listener
     *    returns false.
     */
    class Target extends Disposable {
      /**
       * @param {*} [target] Default event target for dispatched events.
       */
      constructor(target) {
        super();

        /**
         * @private
         * @type {*}
         */
        this.eventTarget_ = target;

        /**
         * @private
         * @type {Object<string, number>}
         */
        this.pendingRemovals_ = null;

        /**
         * @private
         * @type {Object<string, number>}
         */
        this.dispatching_ = null;

        /**
         * @private
         * @type {Object<string, Array<import("../events.js").Listener>>}
         */
        this.listeners_ = null;
      }

      /**
       * @param {string} type Type.
       * @param {import("../events.js").Listener} listener Listener.
       */
      addEventListener(type, listener) {
        if (!type || !listener) {
          return;
        }
        const listeners = this.listeners_ || (this.listeners_ = {});
        const listenersForType = listeners[type] || (listeners[type] = []);
        if (!listenersForType.includes(listener)) {
          listenersForType.push(listener);
        }
      }

      /**
       * Dispatches an event and calls all listeners listening for events
       * of this type. The event parameter can either be a string or an
       * Object with a `type` property.
       *
       * @param {import("./Event.js").default|string} event Event object.
       * @return {boolean|undefined} `false` if anyone called preventDefault on the
       *     event object or if any of the listeners returned false.
       * @api
       */
      dispatchEvent(event) {
        const isString = typeof event === 'string';
        const type = isString ? event : event.type;
        const listeners = this.listeners_ && this.listeners_[type];
        if (!listeners) {
          return;
        }

        const evt = isString ? new BaseEvent(event) : /** @type {Event} */ (event);
        if (!evt.target) {
          evt.target = this.eventTarget_ || this;
        }
        const dispatching = this.dispatching_ || (this.dispatching_ = {});
        const pendingRemovals =
          this.pendingRemovals_ || (this.pendingRemovals_ = {});
        if (!(type in dispatching)) {
          dispatching[type] = 0;
          pendingRemovals[type] = 0;
        }
        ++dispatching[type];
        let propagate;
        for (let i = 0, ii = listeners.length; i < ii; ++i) {
          if ('handleEvent' in listeners[i]) {
            propagate = /** @type {import("../events.js").ListenerObject} */ (
              listeners[i]
            ).handleEvent(evt);
          } else {
            propagate = /** @type {import("../events.js").ListenerFunction} */ (
              listeners[i]
            ).call(this, evt);
          }
          if (propagate === false || evt.propagationStopped) {
            propagate = false;
            break;
          }
        }
        if (--dispatching[type] === 0) {
          let pr = pendingRemovals[type];
          delete pendingRemovals[type];
          while (pr--) {
            this.removeEventListener(type, VOID);
          }
          delete dispatching[type];
        }
        return propagate;
      }

      /**
       * Clean up.
       */
      disposeInternal() {
        this.listeners_ && clear(this.listeners_);
      }

      /**
       * Get the listeners for a specified event type. Listeners are returned in the
       * order that they will be called in.
       *
       * @param {string} type Type.
       * @return {Array<import("../events.js").Listener>|undefined} Listeners.
       */
      getListeners(type) {
        return (this.listeners_ && this.listeners_[type]) || undefined;
      }

      /**
       * @param {string} [type] Type. If not provided,
       *     `true` will be returned if this event target has any listeners.
       * @return {boolean} Has listeners.
       */
      hasListener(type) {
        if (!this.listeners_) {
          return false;
        }
        return type
          ? type in this.listeners_
          : Object.keys(this.listeners_).length > 0;
      }

      /**
       * @param {string} type Type.
       * @param {import("../events.js").Listener} listener Listener.
       */
      removeEventListener(type, listener) {
        const listeners = this.listeners_ && this.listeners_[type];
        if (listeners) {
          const index = listeners.indexOf(listener);
          if (index !== -1) {
            if (this.pendingRemovals_ && type in this.pendingRemovals_) {
              // make listener a no-op, and remove later in #dispatchEvent()
              listeners[index] = VOID;
              ++this.pendingRemovals_[type];
            } else {
              listeners.splice(index, 1);
              if (listeners.length === 0) {
                delete this.listeners_[type];
              }
            }
          }
        }
      }
    }

    /**
     * @module ol/events/EventType
     */

    /**
     * @enum {string}
     * @const
     */
    var EventType = {
      /**
       * Generic change event. Triggered when the revision counter is increased.
       * @event module:ol/events/Event~BaseEvent#change
       * @api
       */
      CHANGE: 'change',

      /**
       * Generic error event. Triggered when an error occurs.
       * @event module:ol/events/Event~BaseEvent#error
       * @api
       */
      ERROR: 'error',

      BLUR: 'blur',
      CLEAR: 'clear',
      CONTEXTMENU: 'contextmenu',
      CLICK: 'click',
      DBLCLICK: 'dblclick',
      DRAGENTER: 'dragenter',
      DRAGOVER: 'dragover',
      DROP: 'drop',
      FOCUS: 'focus',
      KEYDOWN: 'keydown',
      KEYPRESS: 'keypress',
      LOAD: 'load',
      RESIZE: 'resize',
      TOUCHMOVE: 'touchmove',
      WHEEL: 'wheel',
    };

    /**
     * @module ol/events
     */

    /**
     * Key to use with {@link module:ol/Observable.unByKey}.
     * @typedef {Object} EventsKey
     * @property {ListenerFunction} listener Listener.
     * @property {import("./events/Target.js").EventTargetLike} target Target.
     * @property {string} type Type.
     * @api
     */

    /**
     * Listener function. This function is called with an event object as argument.
     * When the function returns `false`, event propagation will stop.
     *
     * @typedef {function((Event|import("./events/Event.js").default)): (void|boolean)} ListenerFunction
     * @api
     */

    /**
     * @typedef {Object} ListenerObject
     * @property {ListenerFunction} handleEvent HandleEvent listener function.
     */

    /**
     * @typedef {ListenerFunction|ListenerObject} Listener
     */

    /**
     * Registers an event listener on an event target. Inspired by
     * https://google.github.io/closure-library/api/source/closure/goog/events/events.js.src.html
     *
     * This function efficiently binds a `listener` to a `this` object, and returns
     * a key for use with {@link module:ol/events.unlistenByKey}.
     *
     * @param {import("./events/Target.js").EventTargetLike} target Event target.
     * @param {string} type Event type.
     * @param {ListenerFunction} listener Listener.
     * @param {Object} [thisArg] Object referenced by the `this` keyword in the
     *     listener. Default is the `target`.
     * @param {boolean} [once] If true, add the listener as one-off listener.
     * @return {EventsKey} Unique key for the listener.
     */
    function listen(target, type, listener, thisArg, once) {
      if (thisArg && thisArg !== target) {
        listener = listener.bind(thisArg);
      }
      if (once) {
        const originalListener = listener;
        listener = function () {
          target.removeEventListener(type, listener);
          originalListener.apply(this, arguments);
        };
      }
      const eventsKey = {
        target: target,
        type: type,
        listener: listener,
      };
      target.addEventListener(type, listener);
      return eventsKey;
    }

    /**
     * Registers a one-off event listener on an event target. Inspired by
     * https://google.github.io/closure-library/api/source/closure/goog/events/events.js.src.html
     *
     * This function efficiently binds a `listener` as self-unregistering listener
     * to a `this` object, and returns a key for use with
     * {@link module:ol/events.unlistenByKey} in case the listener needs to be
     * unregistered before it is called.
     *
     * When {@link module:ol/events.listen} is called with the same arguments after this
     * function, the self-unregistering listener will be turned into a permanent
     * listener.
     *
     * @param {import("./events/Target.js").EventTargetLike} target Event target.
     * @param {string} type Event type.
     * @param {ListenerFunction} listener Listener.
     * @param {Object} [thisArg] Object referenced by the `this` keyword in the
     *     listener. Default is the `target`.
     * @return {EventsKey} Key for unlistenByKey.
     */
    function listenOnce(target, type, listener, thisArg) {
      return listen(target, type, listener, thisArg, true);
    }

    /**
     * Unregisters event listeners on an event target. Inspired by
     * https://google.github.io/closure-library/api/source/closure/goog/events/events.js.src.html
     *
     * The argument passed to this function is the key returned from
     * {@link module:ol/events.listen} or {@link module:ol/events.listenOnce}.
     *
     * @param {EventsKey} key The key.
     */
    function unlistenByKey(key) {
      if (key && key.target) {
        key.target.removeEventListener(key.type, key.listener);
        clear(key);
      }
    }

    /**
     * @module ol/Observable
     */

    /***
     * @template {string} Type
     * @template {Event|import("./events/Event.js").default} EventClass
     * @template Return
     * @typedef {(type: Type, listener: (event: EventClass) => ?) => Return} OnSignature
     */

    /***
     * @template {string} Type
     * @template Return
     * @typedef {(type: Type[], listener: (event: Event|import("./events/Event").default) => ?) => Return extends void ? void : Return[]} CombinedOnSignature
     */

    /**
     * @typedef {'change'|'error'} EventTypes
     */

    /***
     * @template Return
     * @typedef {OnSignature<EventTypes, import("./events/Event.js").default, Return> & CombinedOnSignature<EventTypes, Return>} ObservableOnSignature
     */

    /**
     * @classdesc
     * Abstract base class; normally only used for creating subclasses and not
     * instantiated in apps.
     * An event target providing convenient methods for listener registration
     * and unregistration. A generic `change` event is always available through
     * {@link module:ol/Observable~Observable#changed}.
     *
     * @fires import("./events/Event.js").default
     * @api
     */
    class Observable extends Target {
      constructor() {
        super();

        this.on =
          /** @type {ObservableOnSignature<import("./events").EventsKey>} */ (
            this.onInternal
          );

        this.once =
          /** @type {ObservableOnSignature<import("./events").EventsKey>} */ (
            this.onceInternal
          );

        this.un = /** @type {ObservableOnSignature<void>} */ (this.unInternal);

        /**
         * @private
         * @type {number}
         */
        this.revision_ = 0;
      }

      /**
       * Increases the revision counter and dispatches a 'change' event.
       * @api
       */
      changed() {
        ++this.revision_;
        this.dispatchEvent(EventType.CHANGE);
      }

      /**
       * Get the version number for this object.  Each time the object is modified,
       * its version number will be incremented.
       * @return {number} Revision.
       * @api
       */
      getRevision() {
        return this.revision_;
      }

      /**
       * @param {string|Array<string>} type Type.
       * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
       * @return {import("./events.js").EventsKey|Array<import("./events.js").EventsKey>} Event key.
       * @protected
       */
      onInternal(type, listener) {
        if (Array.isArray(type)) {
          const len = type.length;
          const keys = new Array(len);
          for (let i = 0; i < len; ++i) {
            keys[i] = listen(this, type[i], listener);
          }
          return keys;
        }
        return listen(this, /** @type {string} */ (type), listener);
      }

      /**
       * @param {string|Array<string>} type Type.
       * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
       * @return {import("./events.js").EventsKey|Array<import("./events.js").EventsKey>} Event key.
       * @protected
       */
      onceInternal(type, listener) {
        let key;
        if (Array.isArray(type)) {
          const len = type.length;
          key = new Array(len);
          for (let i = 0; i < len; ++i) {
            key[i] = listenOnce(this, type[i], listener);
          }
        } else {
          key = listenOnce(this, /** @type {string} */ (type), listener);
        }
        /** @type {Object} */ (listener).ol_key = key;
        return key;
      }

      /**
       * Unlisten for a certain type of event.
       * @param {string|Array<string>} type Type.
       * @param {function((Event|import("./events/Event").default)): ?} listener Listener.
       * @protected
       */
      unInternal(type, listener) {
        const key = /** @type {Object} */ (listener).ol_key;
        if (key) {
          unByKey(key);
        } else if (Array.isArray(type)) {
          for (let i = 0, ii = type.length; i < ii; ++i) {
            this.removeEventListener(type[i], listener);
          }
        } else {
          this.removeEventListener(type, listener);
        }
      }
    }

    /**
     * Listen for a certain type of event.
     * @function
     * @param {string|Array<string>} type The event type or array of event types.
     * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
     * @return {import("./events.js").EventsKey|Array<import("./events.js").EventsKey>} Unique key for the listener. If
     *     called with an array of event types as the first argument, the return
     *     will be an array of keys.
     * @api
     */
    Observable.prototype.on;

    /**
     * Listen once for a certain type of event.
     * @function
     * @param {string|Array<string>} type The event type or array of event types.
     * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
     * @return {import("./events.js").EventsKey|Array<import("./events.js").EventsKey>} Unique key for the listener. If
     *     called with an array of event types as the first argument, the return
     *     will be an array of keys.
     * @api
     */
    Observable.prototype.once;

    /**
     * Unlisten for a certain type of event.
     * @function
     * @param {string|Array<string>} type The event type or array of event types.
     * @param {function((Event|import("./events/Event").default)): ?} listener The listener function.
     * @api
     */
    Observable.prototype.un;

    /**
     * Removes an event listener using the key returned by `on()` or `once()`.
     * @param {import("./events.js").EventsKey|Array<import("./events.js").EventsKey>} key The key returned by `on()`
     *     or `once()` (or an array of keys).
     * @api
     */
    function unByKey(key) {
      if (Array.isArray(key)) {
        for (let i = 0, ii = key.length; i < ii; ++i) {
          unlistenByKey(key[i]);
        }
      } else {
        unlistenByKey(/** @type {import("./events.js").EventsKey} */ (key));
      }
    }

    /**
     * @module ol/has
     */

    const ua =
      typeof navigator !== 'undefined' && typeof navigator.userAgent !== 'undefined'
        ? navigator.userAgent.toLowerCase()
        : '';

    /**
     * User agent string says we are dealing with Firefox as browser.
     * @type {boolean}
     */
    const FIREFOX = ua.includes('firefox');

    /**
     * User agent string says we are dealing with Safari as browser.
     * @type {boolean}
     */
    const SAFARI = ua.includes('safari') && !ua.includes('chrom');

    /**
     * https://bugs.webkit.org/show_bug.cgi?id=237906
     * @type {boolean}
     */
    const SAFARI_BUG_237906 =
      SAFARI &&
      (ua.includes('version/15.4') ||
        /cpu (os|iphone os) 15_4 like mac os x/.test(ua));

    /**
     * User agent string says we are dealing with a WebKit engine.
     * @type {boolean}
     */
    const WEBKIT = ua.includes('webkit') && !ua.includes('edge');

    /**
     * User agent string says we are dealing with a Mac as platform.
     * @type {boolean}
     */
    const MAC = ua.includes('macintosh');

    /**
     * The execution context is a worker with OffscreenCanvas available.
     * @const
     * @type {boolean}
     */
    const WORKER_OFFSCREEN_CANVAS =
      typeof WorkerGlobalScope !== 'undefined' &&
      typeof OffscreenCanvas !== 'undefined' &&
      self instanceof WorkerGlobalScope; //eslint-disable-line

    /**
     * @type {boolean}
     */
    const PASSIVE_EVENT_LISTENERS = (function () {
      let passive = false;
      try {
        const options = Object.defineProperty({}, 'passive', {
          get: function () {
            passive = true;
          },
        });

        window.addEventListener('_', null, options);
        window.removeEventListener('_', null, options);
      } catch (error) {
        // passive not supported
      }
      return passive;
    })();

    /**
     * @module ol/transform
     */

    /**
     * An array representing an affine 2d transformation for use with
     * {@link module:ol/transform} functions. The array has 6 elements.
     * @typedef {!Array<number>} Transform
     * @api
     */

    /**
     * Collection of affine 2d transformation functions. The functions work on an
     * array of 6 elements. The element order is compatible with the [SVGMatrix
     * interface](https://developer.mozilla.org/en-US/docs/Web/API/SVGMatrix) and is
     * a subset (elements a to f) of a 3×3 matrix:
     * ```
     * [ a c e ]
     * [ b d f ]
     * [ 0 0 1 ]
     * ```
     */

    /**
     * @private
     * @type {Transform}
     */
    const tmp_ = new Array(6);

    /**
     * @module ol/proj/Units
     */

    /**
     * @typedef {Object} MetersPerUnitLookup
     * @property {number} radians Radians
     * @property {number} degrees Degrees
     * @property {number} ft  Feet
     * @property {number} m Meters
     * @property {number} us-ft US feet
     */

    /**
     * Meters per unit lookup table.
     * @const
     * @type {MetersPerUnitLookup}
     * @api
     */
    const METERS_PER_UNIT = {
      // use the radius of the Normal sphere
      'radians': 6370997 / (2 * Math.PI),
      'degrees': (2 * Math.PI * 6370997) / 360,
      'ft': 0.3048,
      'm': 1,
      'us-ft': 1200 / 3937,
    };

    /**
     * @module ol/proj/Projection
     */

    /**
     * @typedef {Object} Options
     * @property {string} code The SRS identifier code, e.g. `EPSG:4326`.
     * @property {import("./Units.js").Units} [units] Units. Required unless a
     * proj4 projection is defined for `code`.
     * @property {import("../extent.js").Extent} [extent] The validity extent for the SRS.
     * @property {string} [axisOrientation='enu'] The axis orientation as specified in Proj4.
     * @property {boolean} [global=false] Whether the projection is valid for the whole globe.
     * @property {number} [metersPerUnit] The meters per unit for the SRS.
     * If not provided, the `units` are used to get the meters per unit from the {@link METERS_PER_UNIT}
     * lookup table.
     * @property {import("../extent.js").Extent} [worldExtent] The world extent for the SRS.
     * @property {function(number, import("../coordinate.js").Coordinate):number} [getPointResolution]
     * Function to determine resolution at a point. The function is called with a
     * `number` view resolution and a {@link module:ol/coordinate~Coordinate} as arguments, and returns
     * the `number` resolution in projection units at the passed coordinate. If this is `undefined`,
     * the default {@link module:ol/proj.getPointResolution} function will be used.
     */

    /**
     * @classdesc
     * Projection definition class. One of these is created for each projection
     * supported in the application and stored in the {@link module:ol/proj} namespace.
     * You can use these in applications, but this is not required, as API params
     * and options use {@link module:ol/proj~ProjectionLike} which means the simple string
     * code will suffice.
     *
     * You can use {@link module:ol/proj.get} to retrieve the object for a particular
     * projection.
     *
     * The library includes definitions for `EPSG:4326` and `EPSG:3857`, together
     * with the following aliases:
     * * `EPSG:4326`: CRS:84, urn:ogc:def:crs:EPSG:6.6:4326,
     *     urn:ogc:def:crs:OGC:1.3:CRS84, urn:ogc:def:crs:OGC:2:84,
     *     http://www.opengis.net/gml/srs/epsg.xml#4326,
     *     urn:x-ogc:def:crs:EPSG:4326
     * * `EPSG:3857`: EPSG:102100, EPSG:102113, EPSG:900913,
     *     urn:ogc:def:crs:EPSG:6.18:3:3857,
     *     http://www.opengis.net/gml/srs/epsg.xml#3857
     *
     * If you use [proj4js](https://github.com/proj4js/proj4js), aliases can
     * be added using `proj4.defs()`. After all required projection definitions are
     * added, call the {@link module:ol/proj/proj4.register} function.
     *
     * @api
     */
    class Projection {
      /**
       * @param {Options} options Projection options.
       */
      constructor(options) {
        /**
         * @private
         * @type {string}
         */
        this.code_ = options.code;

        /**
         * Units of projected coordinates. When set to `TILE_PIXELS`, a
         * `this.extent_` and `this.worldExtent_` must be configured properly for each
         * tile.
         * @private
         * @type {import("./Units.js").Units}
         */
        this.units_ = /** @type {import("./Units.js").Units} */ (options.units);

        /**
         * Validity extent of the projection in projected coordinates. For projections
         * with `TILE_PIXELS` units, this is the extent of the tile in
         * tile pixel space.
         * @private
         * @type {import("../extent.js").Extent}
         */
        this.extent_ = options.extent !== undefined ? options.extent : null;

        /**
         * Extent of the world in EPSG:4326. For projections with
         * `TILE_PIXELS` units, this is the extent of the tile in
         * projected coordinate space.
         * @private
         * @type {import("../extent.js").Extent}
         */
        this.worldExtent_ =
          options.worldExtent !== undefined ? options.worldExtent : null;

        /**
         * @private
         * @type {string}
         */
        this.axisOrientation_ =
          options.axisOrientation !== undefined ? options.axisOrientation : 'enu';

        /**
         * @private
         * @type {boolean}
         */
        this.global_ = options.global !== undefined ? options.global : false;

        /**
         * @private
         * @type {boolean}
         */
        this.canWrapX_ = !!(this.global_ && this.extent_);

        /**
         * @private
         * @type {function(number, import("../coordinate.js").Coordinate):number|undefined}
         */
        this.getPointResolutionFunc_ = options.getPointResolution;

        /**
         * @private
         * @type {import("../tilegrid/TileGrid.js").default}
         */
        this.defaultTileGrid_ = null;

        /**
         * @private
         * @type {number|undefined}
         */
        this.metersPerUnit_ = options.metersPerUnit;
      }

      /**
       * @return {boolean} The projection is suitable for wrapping the x-axis
       */
      canWrapX() {
        return this.canWrapX_;
      }

      /**
       * Get the code for this projection, e.g. 'EPSG:4326'.
       * @return {string} Code.
       * @api
       */
      getCode() {
        return this.code_;
      }

      /**
       * Get the validity extent for this projection.
       * @return {import("../extent.js").Extent} Extent.
       * @api
       */
      getExtent() {
        return this.extent_;
      }

      /**
       * Get the units of this projection.
       * @return {import("./Units.js").Units} Units.
       * @api
       */
      getUnits() {
        return this.units_;
      }

      /**
       * Get the amount of meters per unit of this projection.  If the projection is
       * not configured with `metersPerUnit` or a units identifier, the return is
       * `undefined`.
       * @return {number|undefined} Meters.
       * @api
       */
      getMetersPerUnit() {
        return this.metersPerUnit_ || METERS_PER_UNIT[this.units_];
      }

      /**
       * Get the world extent for this projection.
       * @return {import("../extent.js").Extent} Extent.
       * @api
       */
      getWorldExtent() {
        return this.worldExtent_;
      }

      /**
       * Get the axis orientation of this projection.
       * Example values are:
       * enu - the default easting, northing, elevation.
       * neu - northing, easting, up - useful for "lat/long" geographic coordinates,
       *     or south orientated transverse mercator.
       * wnu - westing, northing, up - some planetary coordinate systems have
       *     "west positive" coordinate systems
       * @return {string} Axis orientation.
       * @api
       */
      getAxisOrientation() {
        return this.axisOrientation_;
      }

      /**
       * Is this projection a global projection which spans the whole world?
       * @return {boolean} Whether the projection is global.
       * @api
       */
      isGlobal() {
        return this.global_;
      }

      /**
       * Set if the projection is a global projection which spans the whole world
       * @param {boolean} global Whether the projection is global.
       * @api
       */
      setGlobal(global) {
        this.global_ = global;
        this.canWrapX_ = !!(global && this.extent_);
      }

      /**
       * @return {import("../tilegrid/TileGrid.js").default} The default tile grid.
       */
      getDefaultTileGrid() {
        return this.defaultTileGrid_;
      }

      /**
       * @param {import("../tilegrid/TileGrid.js").default} tileGrid The default tile grid.
       */
      setDefaultTileGrid(tileGrid) {
        this.defaultTileGrid_ = tileGrid;
      }

      /**
       * Set the validity extent for this projection.
       * @param {import("../extent.js").Extent} extent Extent.
       * @api
       */
      setExtent(extent) {
        this.extent_ = extent;
        this.canWrapX_ = !!(this.global_ && extent);
      }

      /**
       * Set the world extent for this projection.
       * @param {import("../extent.js").Extent} worldExtent World extent
       *     [minlon, minlat, maxlon, maxlat].
       * @api
       */
      setWorldExtent(worldExtent) {
        this.worldExtent_ = worldExtent;
      }

      /**
       * Set the getPointResolution function (see {@link module:ol/proj.getPointResolution}
       * for this projection.
       * @param {function(number, import("../coordinate.js").Coordinate):number} func Function
       * @api
       */
      setGetPointResolution(func) {
        this.getPointResolutionFunc_ = func;
      }

      /**
       * Get the custom point resolution function for this projection (if set).
       * @return {function(number, import("../coordinate.js").Coordinate):number|undefined} The custom point
       * resolution function (if set).
       */
      getPointResolutionFunc() {
        return this.getPointResolutionFunc_;
      }
    }

    /**
     * @module ol/proj/epsg3857
     */

    /**
     * Radius of WGS84 sphere
     *
     * @const
     * @type {number}
     */
    const RADIUS = 6378137;

    /**
     * @const
     * @type {number}
     */
    const HALF_SIZE = Math.PI * RADIUS;

    /**
     * @const
     * @type {import("../extent.js").Extent}
     */
    const EXTENT = [-HALF_SIZE, -HALF_SIZE, HALF_SIZE, HALF_SIZE];

    /**
     * @const
     * @type {import("../extent.js").Extent}
     */
    const WORLD_EXTENT = [-180, -85, 180, 85];

    /**
     * Maximum safe value in y direction
     * @const
     * @type {number}
     */
    const MAX_SAFE_Y = RADIUS * Math.log(Math.tan(Math.PI / 2));

    /**
     * @classdesc
     * Projection object for web/spherical Mercator (EPSG:3857).
     */
    class EPSG3857Projection extends Projection {
      /**
       * @param {string} code Code.
       */
      constructor(code) {
        super({
          code: code,
          units: 'm',
          extent: EXTENT,
          global: true,
          worldExtent: WORLD_EXTENT,
          getPointResolution: function (resolution, point) {
            return resolution / Math.cosh(point[1] / RADIUS);
          },
        });
      }
    }

    /**
     * Projections equal to EPSG:3857.
     *
     * @const
     * @type {Array<import("./Projection.js").default>}
     */
    const PROJECTIONS = [
      new EPSG3857Projection('EPSG:3857'),
      new EPSG3857Projection('EPSG:102100'),
      new EPSG3857Projection('EPSG:102113'),
      new EPSG3857Projection('EPSG:900913'),
      new EPSG3857Projection('http://www.opengis.net/def/crs/EPSG/0/3857'),
      new EPSG3857Projection('http://www.opengis.net/gml/srs/epsg.xml#3857'),
    ];

    /**
     * Transformation from EPSG:4326 to EPSG:3857.
     *
     * @param {Array<number>} input Input array of coordinate values.
     * @param {Array<number>} [output] Output array of coordinate values.
     * @param {number} [dimension] Dimension (default is `2`).
     * @return {Array<number>} Output array of coordinate values.
     */
    function fromEPSG4326(input, output, dimension) {
      const length = input.length;
      dimension = dimension > 1 ? dimension : 2;
      if (output === undefined) {
        if (dimension > 2) {
          // preserve values beyond second dimension
          output = input.slice();
        } else {
          output = new Array(length);
        }
      }
      for (let i = 0; i < length; i += dimension) {
        output[i] = (HALF_SIZE * input[i]) / 180;
        let y = RADIUS * Math.log(Math.tan((Math.PI * (+input[i + 1] + 90)) / 360));
        if (y > MAX_SAFE_Y) {
          y = MAX_SAFE_Y;
        } else if (y < -MAX_SAFE_Y) {
          y = -MAX_SAFE_Y;
        }
        output[i + 1] = y;
      }
      return output;
    }

    /**
     * Transformation from EPSG:3857 to EPSG:4326.
     *
     * @param {Array<number>} input Input array of coordinate values.
     * @param {Array<number>} [output] Output array of coordinate values.
     * @param {number} [dimension] Dimension (default is `2`).
     * @return {Array<number>} Output array of coordinate values.
     */
    function toEPSG4326(input, output, dimension) {
      const length = input.length;
      dimension = dimension > 1 ? dimension : 2;
      if (output === undefined) {
        if (dimension > 2) {
          // preserve values beyond second dimension
          output = input.slice();
        } else {
          output = new Array(length);
        }
      }
      for (let i = 0; i < length; i += dimension) {
        output[i] = (180 * input[i]) / HALF_SIZE;
        output[i + 1] =
          (360 * Math.atan(Math.exp(input[i + 1] / RADIUS))) / Math.PI - 90;
      }
      return output;
    }

    /**
     * @module ol/proj/epsg4326
     */

    /**
     * Semi-major radius of the WGS84 ellipsoid.
     *
     * @const
     * @type {number}
     */
    const RADIUS$1 = 6378137;

    /**
     * Extent of the EPSG:4326 projection which is the whole world.
     *
     * @const
     * @type {import("../extent.js").Extent}
     */
    const EXTENT$1 = [-180, -90, 180, 90];

    /**
     * @const
     * @type {number}
     */
    const METERS_PER_UNIT$1 = (Math.PI * RADIUS$1) / 180;

    /**
     * @classdesc
     * Projection object for WGS84 geographic coordinates (EPSG:4326).
     *
     * Note that OpenLayers does not strictly comply with the EPSG definition.
     * The EPSG registry defines 4326 as a CRS for Latitude,Longitude (y,x).
     * OpenLayers treats EPSG:4326 as a pseudo-projection, with x,y coordinates.
     */
    class EPSG4326Projection extends Projection {
      /**
       * @param {string} code Code.
       * @param {string} [axisOrientation] Axis orientation.
       */
      constructor(code, axisOrientation) {
        super({
          code: code,
          units: 'degrees',
          extent: EXTENT$1,
          axisOrientation: axisOrientation,
          global: true,
          metersPerUnit: METERS_PER_UNIT$1,
          worldExtent: EXTENT$1,
        });
      }
    }

    /**
     * Projections equal to EPSG:4326.
     *
     * @const
     * @type {Array<import("./Projection.js").default>}
     */
    const PROJECTIONS$1 = [
      new EPSG4326Projection('CRS:84'),
      new EPSG4326Projection('EPSG:4326', 'neu'),
      new EPSG4326Projection('urn:ogc:def:crs:OGC:1.3:CRS84'),
      new EPSG4326Projection('urn:ogc:def:crs:OGC:2:84'),
      new EPSG4326Projection('http://www.opengis.net/def/crs/OGC/1.3/CRS84'),
      new EPSG4326Projection('http://www.opengis.net/gml/srs/epsg.xml#4326', 'neu'),
      new EPSG4326Projection('http://www.opengis.net/def/crs/EPSG/0/4326', 'neu'),
    ];

    /**
     * @module ol/proj/projections
     */

    /**
     * Add a projection to the cache.
     * @param {string} code The projection code.
     * @param {import("./Projection.js").default} projection The projection to cache.
     */
    function add(code, projection) {
    }

    /**
     * @module ol/proj/transforms
     */

    /**
     * @private
     * @type {!Object<string, Object<string, import("../proj.js").TransformFunction>>}
     */
    let transforms = {};

    /**
     * Registers a conversion function to convert coordinates from the source
     * projection to the destination projection.
     *
     * @param {import("./Projection.js").default} source Source.
     * @param {import("./Projection.js").default} destination Destination.
     * @param {import("../proj.js").TransformFunction} transformFn Transform.
     */
    function add$1(source, destination, transformFn) {
      const sourceCode = source.getCode();
      const destinationCode = destination.getCode();
      if (!(sourceCode in transforms)) {
        transforms[sourceCode] = {};
      }
      transforms[sourceCode][destinationCode] = transformFn;
    }

    /**
     * @module ol/proj
     */

    /**
     * @param {Array<number>} input Input coordinate array.
     * @param {Array<number>} [output] Output array of coordinate values.
     * @return {Array<number>} Output coordinate array (new array, same coordinate
     *     values).
     */
    function cloneTransform(input, output) {
      if (output !== undefined) {
        for (let i = 0, ii = input.length; i < ii; ++i) {
          output[i] = input[i];
        }
        output = output;
      } else {
        output = input.slice();
      }
      return output;
    }

    /**
     * Add a Projection object to the list of supported projections that can be
     * looked up by their code.
     *
     * @param {Projection} projection Projection instance.
     * @api
     */
    function addProjection(projection) {
      add(projection.getCode());
      add$1(projection, projection, cloneTransform);
    }

    /**
     * @param {Array<Projection>} projections Projections.
     */
    function addProjections(projections) {
      projections.forEach(addProjection);
    }

    /**
     * Registers transformation functions that don't alter coordinates. Those allow
     * to transform between projections with equal meaning.
     *
     * @param {Array<Projection>} projections Projections.
     * @api
     */
    function addEquivalentProjections(projections) {
      addProjections(projections);
      projections.forEach(function (source) {
        projections.forEach(function (destination) {
          if (source !== destination) {
            add$1(source, destination, cloneTransform);
          }
        });
      });
    }

    /**
     * Registers transformation functions to convert coordinates in any projection
     * in projection1 to any projection in projection2.
     *
     * @param {Array<Projection>} projections1 Projections with equal
     *     meaning.
     * @param {Array<Projection>} projections2 Projections with equal
     *     meaning.
     * @param {TransformFunction} forwardTransform Transformation from any
     *   projection in projection1 to any projection in projection2.
     * @param {TransformFunction} inverseTransform Transform from any projection
     *   in projection2 to any projection in projection1..
     */
    function addEquivalentTransforms(
      projections1,
      projections2,
      forwardTransform,
      inverseTransform
    ) {
      projections1.forEach(function (projection1) {
        projections2.forEach(function (projection2) {
          add$1(projection1, projection2, forwardTransform);
          add$1(projection2, projection1, inverseTransform);
        });
      });
    }

    /**
     * Add transforms to and from EPSG:4326 and EPSG:3857.  This function is called
     * by when this module is executed and should only need to be called again after
     * `clearAllProjections()` is called (e.g. in tests).
     */
    function addCommon() {
      // Add transformations that don't alter coordinates to convert within set of
      // projections with equal meaning.
      addEquivalentProjections(PROJECTIONS);
      addEquivalentProjections(PROJECTIONS$1);
      // Add transformations to convert EPSG:4326 like coordinates to EPSG:3857 like
      // coordinates and back.
      addEquivalentTransforms(
        PROJECTIONS$1,
        PROJECTIONS,
        fromEPSG4326,
        toEPSG4326
      );
    }

    addCommon();

    function extractParts(xy, z, ends) {
        if (!ends || ends.length === 0)
            return [pairFlatCoordinates(xy, z)];
        let s = 0;
        const xySlices = Array.from(ends).map((e) => xy.slice(s, (s = e << 1)));
        let zSlices;
        if (z) {
            s = 0;
            zSlices = Array.from(ends).map((e) => z.slice(s, (s = e)));
        }
        return xySlices.map((xy, i) => pairFlatCoordinates(xy, zSlices ? zSlices[i] : undefined));
    }
    function toGeoJsonCoordinates(geometry, type) {
        const xy = geometry.xyArray();
        const z = geometry.zArray();
        switch (type) {
            case GeometryType.Point: {
                const a = Array.from(xy);
                if (z)
                    a.push(z[0]);
                return a;
            }
            case GeometryType.MultiPoint:
            case GeometryType.LineString:
                return pairFlatCoordinates(xy, z);
            case GeometryType.MultiLineString:
                return extractParts(xy, z, geometry.endsArray());
            case GeometryType.Polygon:
                return extractParts(xy, z, geometry.endsArray());
        }
    }
    function fromGeometry(geometry, headerType) {
        let type = headerType;
        if (type === GeometryType.Unknown) {
            type = geometry.type();
        }
        if (type === GeometryType.GeometryCollection) {
            const geometries = [];
            for (let i = 0; i < geometry.partsLength(); i++) {
                const part = geometry.parts(i);
                const partType = part.type();
                geometries.push(fromGeometry(part, partType));
            }
            return {
                type: GeometryType[type],
                geometries,
            };
        }
        else if (type === GeometryType.MultiPolygon) {
            const geometries = [];
            for (let i = 0; i < geometry.partsLength(); i++)
                geometries.push(fromGeometry(geometry.parts(i), GeometryType.Polygon));
            return {
                type: GeometryType[type],
                coordinates: geometries.map((g) => g.coordinates),
            };
        }
        const coordinates = toGeoJsonCoordinates(geometry, type);
        return {
            type: GeometryType[type],
            coordinates,
        };
    }

    function fromFeature(feature, header) {
        const columns = header.columns;
        const geometry = fromGeometry(feature.geometry(), header.geometryType);
        const geoJsonfeature = {
            type: 'Feature',
            geometry,
            properties: parseProperties(feature, columns),
        };
        return geoJsonfeature;
    }

    function deserialize$1(bytes, headerMetaFn) {
        const features = deserialize(bytes, fromFeature, headerMetaFn);
        return {
            type: 'FeatureCollection',
            features,
        };
    }
    function deserializeStream$1(stream, headerMetaFn) {
        return deserializeStream(stream, fromFeature, headerMetaFn);
    }
    function deserializeFiltered$1(url, rect, headerMetaFn) {
        return deserializeFiltered(url, rect, fromFeature, headerMetaFn);
    }

    function deserialize$2(input, rect, headerMetaFn) {
        if (input instanceof Uint8Array)
            return deserialize$1(input, headerMetaFn);
        else if (input instanceof ReadableStream)
            return deserializeStream$1(input, headerMetaFn);
        else
            return deserializeFiltered$1(input, rect, headerMetaFn);
    }

    var d2r = Math.PI / 180,
        r2d = 180 / Math.PI;

    /**
     * Get the bbox of a tile
     *
     * @name tileToBBOX
     * @param {Array<number>} tile
     * @returns {Array<number>} bbox
     * @example
     * var bbox = tileToBBOX([5, 10, 10])
     * //=bbox
     */
    function tileToBBOX(tile) {
        var e = tile2lon(tile[0] + 1, tile[2]);
        var w = tile2lon(tile[0], tile[2]);
        var s = tile2lat(tile[1] + 1, tile[2]);
        var n = tile2lat(tile[1], tile[2]);
        return [w, s, e, n];
    }

    /**
     * Get a geojson representation of a tile
     *
     * @name tileToGeoJSON
     * @param {Array<number>} tile
     * @returns {Feature<Polygon>}
     * @example
     * var poly = tileToGeoJSON([5, 10, 10])
     * //=poly
     */
    function tileToGeoJSON(tile) {
        var bbox = tileToBBOX(tile);
        var poly = {
            type: 'Polygon',
            coordinates: [[
                [bbox[0], bbox[3]],
                [bbox[0], bbox[1]],
                [bbox[2], bbox[1]],
                [bbox[2], bbox[3]],
                [bbox[0], bbox[3]]
            ]]
        };
        return poly;
    }

    function tile2lon(x, z) {
        return x / Math.pow(2, z) * 360 - 180;
    }

    function tile2lat(y, z) {
        var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
        return r2d * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    }

    /**
     * Get the tile for a point at a specified zoom level
     *
     * @name pointToTile
     * @param {number} lon
     * @param {number} lat
     * @param {number} z
     * @returns {Array<number>} tile
     * @example
     * var tile = pointToTile(1, 1, 20)
     * //=tile
     */
    function pointToTile(lon, lat, z) {
        var tile = pointToTileFraction(lon, lat, z);
        tile[0] = Math.floor(tile[0]);
        tile[1] = Math.floor(tile[1]);
        return tile;
    }

    /**
     * Get the 4 tiles one zoom level higher
     *
     * @name getChildren
     * @param {Array<number>} tile
     * @returns {Array<Array<number>>} tiles
     * @example
     * var tiles = getChildren([5, 10, 10])
     * //=tiles
     */
    function getChildren(tile) {
        return [
            [tile[0] * 2, tile[1] * 2, tile[2] + 1],
            [tile[0] * 2 + 1, tile[1] * 2, tile[2 ] + 1],
            [tile[0] * 2 + 1, tile[1] * 2 + 1, tile[2] + 1],
            [tile[0] * 2, tile[1] * 2 + 1, tile[2] + 1]
        ];
    }

    /**
     * Get the tile one zoom level lower
     *
     * @name getParent
     * @param {Array<number>} tile
     * @returns {Array<number>} tile
     * @example
     * var tile = getParent([5, 10, 10])
     * //=tile
     */
    function getParent(tile) {
        return [tile[0] >> 1, tile[1] >> 1, tile[2] - 1];
    }

    function getSiblings(tile) {
        return getChildren(getParent(tile));
    }

    /**
     * Get the 3 sibling tiles for a tile
     *
     * @name getSiblings
     * @param {Array<number>} tile
     * @returns {Array<Array<number>>} tiles
     * @example
     * var tiles = getSiblings([5, 10, 10])
     * //=tiles
     */
    function hasSiblings(tile, tiles) {
        var siblings = getSiblings(tile);
        for (var i = 0; i < siblings.length; i++) {
            if (!hasTile(tiles, siblings[i])) return false;
        }
        return true;
    }

    /**
     * Check to see if an array of tiles contains a particular tile
     *
     * @name hasTile
     * @param {Array<Array<number>>} tiles
     * @param {Array<number>} tile
     * @returns {boolean}
     * @example
     * var tiles = [
     *     [0, 0, 5],
     *     [0, 1, 5],
     *     [1, 1, 5],
     *     [1, 0, 5]
     * ]
     * hasTile(tiles, [0, 0, 5])
     * //=boolean
     */
    function hasTile(tiles, tile) {
        for (var i = 0; i < tiles.length; i++) {
            if (tilesEqual(tiles[i], tile)) return true;
        }
        return false;
    }

    /**
     * Check to see if two tiles are the same
     *
     * @name tilesEqual
     * @param {Array<number>} tile1
     * @param {Array<number>} tile2
     * @returns {boolean}
     * @example
     * tilesEqual([0, 1, 5], [0, 0, 5])
     * //=boolean
     */
    function tilesEqual(tile1, tile2) {
        return (
            tile1[0] === tile2[0] &&
            tile1[1] === tile2[1] &&
            tile1[2] === tile2[2]
        );
    }

    /**
     * Get the quadkey for a tile
     *
     * @name tileToQuadkey
     * @param {Array<number>} tile
     * @returns {string} quadkey
     * @example
     * var quadkey = tileToQuadkey([0, 1, 5])
     * //=quadkey
     */
    function tileToQuadkey(tile) {
        var index = '';
        for (var z = tile[2]; z > 0; z--) {
            var b = 0;
            var mask = 1 << (z - 1);
            if ((tile[0] & mask) !== 0) b++;
            if ((tile[1] & mask) !== 0) b += 2;
            index += b.toString();
        }
        return index;
    }

    /**
     * Get the tile for a quadkey
     *
     * @name quadkeyToTile
     * @param {string} quadkey
     * @returns {Array<number>} tile
     * @example
     * var tile = quadkeyToTile('00001033')
     * //=tile
     */
    function quadkeyToTile(quadkey) {
        var x = 0;
        var y = 0;
        var z = quadkey.length;

        for (var i = z; i > 0; i--) {
            var mask = 1 << (i - 1);
            var q = +quadkey[z - i];
            if (q === 1) x |= mask;
            if (q === 2) y |= mask;
            if (q === 3) {
                x |= mask;
                y |= mask;
            }
        }
        return [x, y, z];
    }

    /**
     * Get the smallest tile to cover a bbox
     *
     * @name bboxToTile
     * @param {Array<number>} bbox
     * @returns {Array<number>} tile
     * @example
     * var tile = bboxToTile([ -178, 84, -177, 85 ])
     * //=tile
     */
    function bboxToTile(bboxCoords) {
        var min = pointToTile(bboxCoords[0], bboxCoords[1], 32);
        var max = pointToTile(bboxCoords[2], bboxCoords[3], 32);
        var bbox = [min[0], min[1], max[0], max[1]];

        var z = getBboxZoom(bbox);
        if (z === 0) return [0, 0, 0];
        var x = bbox[0] >>> (32 - z);
        var y = bbox[1] >>> (32 - z);
        return [x, y, z];
    }

    function getBboxZoom(bbox) {
        var MAX_ZOOM = 28;
        for (var z = 0; z < MAX_ZOOM; z++) {
            var mask = 1 << (32 - (z + 1));
            if (((bbox[0] & mask) !== (bbox[2] & mask)) ||
                ((bbox[1] & mask) !== (bbox[3] & mask))) {
                return z;
            }
        }

        return MAX_ZOOM;
    }

    /**
     * Get the precise fractional tile location for a point at a zoom level
     *
     * @name pointToTileFraction
     * @param {number} lon
     * @param {number} lat
     * @param {number} z
     * @returns {Array<number>} tile fraction
     * var tile = pointToTileFraction(30.5, 50.5, 15)
     * //=tile
     */
    function pointToTileFraction(lon, lat, z) {
        var sin = Math.sin(lat * d2r),
            z2 = Math.pow(2, z),
            x = z2 * (lon / 360 + 0.5),
            y = z2 * (0.5 - 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI);

        // Wrap Tile X
        x = x % z2;
        if (x < 0) x = x + z2;
        return [x, y, z];
    }

    var tilebelt = {
        tileToGeoJSON: tileToGeoJSON,
        tileToBBOX: tileToBBOX,
        getChildren: getChildren,
        getParent: getParent,
        getSiblings: getSiblings,
        hasTile: hasTile,
        hasSiblings: hasSiblings,
        tilesEqual: tilesEqual,
        tileToQuadkey: tileToQuadkey,
        quadkeyToTile: quadkeyToTile,
        pointToTile: pointToTile,
        bboxToTile: bboxToTile,
        pointToTileFraction: pointToTileFraction
    };

    class FlatGeobuf {
      constructor (sourceId, map, flatGeobufOptions, geojsonSourceOptions) {
        if (!sourceId || !map || !flatGeobufOptions) throw new Error('Source id, map and url must be supplied as the first three arguments.')
        if (!flatGeobufOptions.url) throw new Error('A url must be supplied as part of the flatGeobufOptions object.')
        if (!flatGeobufOptions.idProperty) throw new Error('A idProperty must be supplied as part of the flatGeobufOptions object.')

        this.sourceId = sourceId;
        this._map = map;
        this._flatGeobufOptions = Object.assign(flatGeobufOptions, {
          minZoom: 9
        });
        this._options = geojsonSourceOptions ? geojsonSourceOptions : {};

        this._fc = this._getBlankFc();
        this._map.addSource(sourceId, Object.assign(this._options, {
          type: 'geojson',
          data: this._fc
        }));
        this._maxExtent = [-Infinity, Infinity, -Infinity, Infinity];

        this._tileIds = new Map();
        this._fcIds = new Map();

        this.enableRequests();
        this._getTileData();
      }

      destroySource () {
        this.disableRequests();
        this._map.removeSource(this.sourceId);
      }

      disableRequests () {
        this._map.off('moveend', this._boundEvent);
      }

      enableRequests () {
        this._boundEvent = this._getTileData.bind(this);
        this._map.on('moveend', this._boundEvent);
      }

      _getBlankFc () {
        return {
          type: 'FeatureCollection',
          features: []
        }
      }

      async _getTileData () {
        const z = this._map.getZoom();
        if (z < this._flatGeobufOptions.minZoom) return
      
        const bounds = this._map.getBounds().toArray();
        const primaryTile = tilebelt.bboxToTile([bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1]]);
        const tilesToRequest = [];

        if (primaryTile[2] < this._flatGeobufOptions.minZoom) {
          let candidateTiles = tilebelt.getChildren(primaryTile);
          let minZoomOfCandidates = candidateTiles[0][2];
          while (minZoomOfCandidates < this._flatGeobufOptions.minZoom) {
            const newCandidateTiles = [];
            candidateTiles.forEach(t => newCandidateTiles.push(...tilebelt.getChildren(t)));
            candidateTiles = newCandidateTiles;
            minZoomOfCandidates = candidateTiles[0][2];
          }
          for (let index = 0; index < candidateTiles.length; index++) {
            const t = candidateTiles[index];
            if (this._doesTileOverlapBbox(t, bounds)) {
              tilesToRequest.push(t);
            }
          }
        } else {
          tilesToRequest.push(primaryTile);
        }

        for (let index = 0; index < tilesToRequest.length; index++) {
          const t = tilesToRequest[index];
          const quadKey = tilebelt.tileToQuadkey(t);
          if (this._tileIds.has(quadKey)) {
            tilesToRequest.splice(index, 1);
            index--;
          } else this._tileIds.set(quadKey, true);
        }
      
        if (tilesToRequest.length === 0) return
        const compiledBbox = mergeBoundingBoxes(tilesToRequest);
        let iter = this._loadData(compiledBbox);
        await this.iterateItems(iter);
        this._updateFc();
      }

      async iterateItems (iterator) {
        for await (let feature of iterator) {
          if (this._fcIds.has(feature.properties[this._flatGeobufOptions.idProperty])) continue
          this._fc.features.push(feature);
          this._fcIds.set(feature.properties[this._flatGeobufOptions.idProperty]);
        }
      }

      _updateFc (fc) {
        this._map.getSource(this.sourceId).setData(this._fc);
      }

      _doesTileOverlapBbox(tile, bbox) {
        const tileBounds = tile.length === 4 ? tile : tilebelt.tileToBBOX(tile);
        if (tileBounds[2] < bbox[0][0]) return false
        if (tileBounds[0] > bbox[1][0]) return false
        if (tileBounds[3] < bbox[0][1]) return false
        if (tileBounds[1] > bbox[1][1]) return false
        return true
      }

      _loadData (bounds) {
        return deserialize$2(this._flatGeobufOptions.url, fgBoundingBox(bounds))
      }
    }


    function mergeBoundingBoxes (bboxes) {
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;

      for (let index = 0; index < bboxes.length; index++) {
        const tileBounds = tilebelt.tileToBBOX(bboxes[index]);
        xMin = Math.min(xMin, tileBounds[0]);
        xMax = Math.max(xMax, tileBounds[2]);
        yMin = Math.min(yMin, tileBounds[1]);
        yMax = Math.max(yMax, tileBounds[3]);
      }
      return [xMin, yMin, xMax, yMax]
    }

    function fgBoundingBox(bounds) {
      return {
          minX: bounds[0],
          maxX: bounds[2],
          minY: bounds[1],
          maxY: bounds[3],
      };
    }

    return FlatGeobuf;

})));
