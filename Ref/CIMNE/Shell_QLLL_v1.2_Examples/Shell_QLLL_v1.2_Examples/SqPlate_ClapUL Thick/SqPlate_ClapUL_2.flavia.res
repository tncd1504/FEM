Gid Post Results File 1.0 
### 
# MAT-fem Shell QLLL v1.2 
# 
GaussPoints "GPTR" ElemType Quadrilateral  
Number Of Gauss Points: 1  
Natural Coordinates: Internal  
End gausspoints 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1         00000          00000          00000 
     2         00000          00000          00000 
     3         00000          00000          00000 
     4         00000          00000  -2.67857e+000 
     5         00000          00000          00000 
     6         00000          00000          00000 
     7         00000          00000          00000 
     8         00000          00000          00000 
     9         00000          00000          00000 
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1         00000         00000 0.0  
     2         00000         00000 0.0  
     3         00000         00000 0.0  
     4 -3.84131e-017  1.53652e-016 0.0  
     5         00000         00000 0.0  
     6         00000         00000 0.0  
     7         00000         00000 0.0  
     8         00000         00000 0.0  
     9         00000         00000 0.0  
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1         00000         00000  9.37500e+000  
     2         00000         00000  1.56250e+001  
     3         00000         00000  1.56250e+001  
     4         00000         00000         00000  
     5         00000         00000  9.37500e+000  
     6         00000         00000  9.37500e+000  
     7         00000         00000  1.56250e+001  
     8         00000         00000  1.56250e+001  
     9         00000         00000  9.37500e+000  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Local-X-Moment", "Local-Y-Moment", "Local-Z-Moment" 
Values 
     1  3.90625e+000 -3.90625e+000         00000  
     2 -2.83937e-016 -1.56250e+001         00000  
     3  1.56250e+001 -5.37783e-017         00000  
     4         00000         00000         00000  
     5  3.90625e+000  3.90625e+000         00000  
     6 -3.90625e+000 -3.90625e+000         00000  
     7 -2.83937e-016  1.56250e+001         00000  
     8 -1.56250e+001 -2.43283e-015         00000  
     9 -3.90625e+000  3.90625e+000         00000  
End Values 
# 
Result "Local Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1 -3.85186e-034  -7.70372e-034  -7.70372e-034 
     2  9.21914e-018   3.07305e-017  -2.68891e-018 
     3  7.68261e-018   2.30478e-018  -1.07557e-017 
     4  7.70372e-034          00000   3.85186e-034 
     5 -7.70372e-034  -3.08149e-033  -2.04630e-034 
     6  7.70372e-034   1.54074e-033   7.70372e-034 
     7 -9.21914e-018  -3.07305e-017   2.68891e-018 
     8 -7.68261e-018  -2.30478e-018   1.07557e-017 
     9  7.70372e-034   1.54074e-033          00000 
End Values 
Result "Local Membrane" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Nx", "Ny", "Nxy" 
Values 
     1         00000          00000          00000 
     2         00000          00000          00000 
     3         00000          00000          00000 
     4         00000          00000          00000 
     5         00000          00000          00000 
     6         00000          00000          00000 
     7         00000          00000          00000 
     8         00000          00000          00000 
     9         00000          00000          00000 
End Values 
Result "Local Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1 -1.66533e-016   2.77556e-017  0.0 
     2  2.77556e-017   1.87500e+000  0.0 
     3 -1.87500e+000  -9.71445e-017  0.0 
     4  1.11022e-016  -2.22045e-016  0.0 
     5 -2.49800e-016  -2.22045e-016  0.0 
     6  1.11022e-016   1.38778e-016  0.0 
     7  1.38778e-017  -1.87500e+000  0.0 
     8  1.87500e+000   9.02056e-016  0.0 
     9  2.22045e-016          00000  0.0 
End Values 
Result "X vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "XX", "XY", "XZ" 
Values 
     1         00001         00000         00000  
     2         00001         00000         00000  
     3         00001         00000         00000  
     4         00001         00000         00000  
End Values 
# 
Result "Y vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "YX", "YY", "YZ" 
Values 
     1         00000         00001         00000  
     2         00000         00001         00000  
     3         00000         00001         00000  
     4         00000         00001         00000  
End Values 
# 
Result "Z vector" "Load Analysis"  1  Vector OnGaussPoints "GPTR" 
ComponentNames "ZX", "ZY", "ZZ" 
Values 
     1         00000         00000         00001  
     2         00000         00000         00001  
     3         00000         00000         00001  
     4         00000         00000         00001  
End Values 
# 
