# dump the 60k most frequent GloVe words (index order) -> raw/vocab.json
import pickle, json
class D:
    def __setstate__(s, st): s.st = st
class U(pickle.Unpickler):
    def find_class(s, m, n):
        if m.startswith('numpy') or m in ('builtins','collections','copyreg','_codecs'): return super().find_class(m, n)
        return D
st = U(open('raw/glove-wiki-gigaword-50.model','rb')).load().st
json.dump(st['index2word'], open('raw/vocab.json','w'))
