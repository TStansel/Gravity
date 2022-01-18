import numpy as np
import base64

l = [1.23234,123123.2323, 223.2343434,3.4434342]
np_array = np.array(l, dtype=np.float64)
vector_bytes = np_array.tobytes()
print(vector_bytes)
vector_bytes_str = str(vector_bytes)
print(vector_bytes_str)
vector_bytes_str_enc = vector_bytes_str.encode()
bytes_np_dec = vector_bytes_str_enc.decode('unicode-escape').encode('ISO-8859-1')[2:-1]
final_np = np.frombuffer(bytes_np_dec, dtype=np.float64)
print(final_np)