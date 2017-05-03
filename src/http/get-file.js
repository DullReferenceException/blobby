import setHeaders from './set-headers';
import compressFile from './compress-file';

export default opts => {
  const { storage, fileKey, req, res, contentType } = opts;

  storage.fetch(fileKey, {}, (err, headers, data) => {
    if (err) {
      res.statusCode = 404;
      return void res.end();
    }

    opts.realContentType = headers.ContentType && headers.ContentType !== 'binary/octet-stream' ? headers.ContentType : contentType;

    // if etag or last-modified suffice, respond with 304
    const isMatch = (req.headers['if-none-match'] && headers.ETag && req.headers['if-none-match'] === headers.ETag) || 
      (req.headers['if-last-modified'] && headers.LastModified && new Date(req.headers['if-last-modified']) >= headers.LastModified)
    ;

    opts.headers = headers;
    opts.data = data;

    if (isMatch) {
      // forward headers (again) as precaution
      setHeaders(opts);
      res.statusCode = 304;
      return void res.end();
    }

    if (!compressFile(opts)) {
      // if not compressed, handle uncompressed response
      setHeaders(opts);
      res.end(data);
    }
  });
}