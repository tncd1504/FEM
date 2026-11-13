Gid Post Results File 1.0 
### 
# MAT-fem Plate QLLL v1.2 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 0.0         00000  
     2 0.0 0.0         00000  
     3 0.0 0.0         00000  
     4 0.0 0.0 -2.67857e+003  
     5 0.0 0.0         00000  
     6 0.0 0.0         00000  
     7 0.0 0.0         00000  
     8 0.0 0.0         00000  
     9 0.0 0.0         00000  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1         00000         00000 0.0  
     2         00000         00000 0.0  
     3         00000         00000 0.0  
     4 -3.98278e-014  1.19483e-013 0.0  
     5         00000         00000 0.0  
     6         00000         00000 0.0  
     7         00000         00000 0.0  
     8         00000         00000 0.0  
     9         00000         00000 0.0  
End Values 
# 
Result "Reaction" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Z-Force", "X-Moment", "Y-Moment" 
Values 
     1  9.37500e+000  3.90625e+000 -3.90625e+000  
     2  1.56250e+001 -2.90411e-016 -1.56250e+001  
     3  1.56250e+001  1.56250e+001 -2.90411e-016  
     4         00000         00000         00000  
     5  9.37500e+000  3.90625e+000  3.90625e+000  
     6  9.37500e+000 -3.90625e+000 -3.90625e+000  
     7  1.56250e+001 -2.90411e-016  1.56250e+001  
     8  1.56250e+001 -1.56250e+001 -2.61370e-015  
     9  9.37500e+000 -3.90625e+000  3.90625e+000  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1  3.67342e-040  -3.67342e-040          00000 
     2  7.16901e-024   2.38967e-023  -2.78795e-024 
     3  7.96557e-024   2.38967e-024  -8.36384e-024 
     4  7.34684e-040   7.34684e-040          00000 
     5  3.67342e-040   1.46937e-039   4.59177e-041 
     6  3.67342e-040   7.34684e-040          00000 
     7 -7.16901e-024  -2.38967e-023   2.78795e-024 
     8 -7.96557e-024  -2.38967e-024   8.36384e-024 
     9 -7.34684e-040   1.46937e-039          00000 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1 -1.38778e-016  -5.55112e-017  0.0 
     2  1.38778e-017   1.87500e+000  0.0 
     3 -1.87500e+000  -1.11022e-016  0.0 
     4         00000  -2.22045e-016  0.0 
     5 -8.32667e-017  -1.11022e-016  0.0 
     6  1.11022e-016   2.22045e-016  0.0 
     7 -1.38778e-017  -1.87500e+000  0.0 
     8  1.87500e+000   9.43690e-016  0.0 
     9  1.11022e-016   1.11022e-016  0.0 
End Values 
