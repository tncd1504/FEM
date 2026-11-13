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
     4 0.0 0.0 -2.67857e-011  
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
     4 -1.62590e-044  1.05589e-027 0.0  
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
     2  1.56250e+001  1.03871e-032 -1.56250e+001  
     3  1.56250e+001  1.56250e+001 -3.69562e-017  
     4         00000         00000         00000  
     5  9.37500e+000  3.90625e+000  3.90625e+000  
     6  9.37500e+000 -3.90625e+000 -3.90625e+000  
     7  1.56250e+001  1.03871e-032  1.56250e+001  
     8  1.56250e+001 -1.56250e+001 -2.48926e-015  
     9  9.37500e+000 -3.90625e+000  3.90625e+000  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1 -2.88889e-034   3.85186e-034  -7.70372e-034 
     2  6.33534e-018   2.11178e-017          00000 
     3  1.44445e-034  -7.70372e-034  -7.39123e-018 
     4 -3.85186e-034   1.54074e-033   3.85186e-034 
     5         00000  -1.54074e-033  -6.74075e-034 
     6  4.81482e-034   1.54074e-033   7.70372e-034 
     7 -6.33534e-018  -2.11178e-017  -4.81482e-035 
     8  1.39630e-033   4.42964e-033   7.39123e-018 
     9 -3.85186e-034  -1.54074e-033   7.70372e-034 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1         00000  -1.38778e-016  0.0 
     2         00000   1.87500e+000  0.0 
     3 -1.87500e+000  -6.93889e-017  0.0 
     4         00000  -2.77556e-016  0.0 
     5 -2.77556e-017          00000  0.0 
     6         00000   1.38778e-016  0.0 
     7  1.38778e-017  -1.87500e+000  0.0 
     8  1.87500e+000   9.99201e-016  0.0 
     9         00000   1.11022e-016  0.0 
End Values 
