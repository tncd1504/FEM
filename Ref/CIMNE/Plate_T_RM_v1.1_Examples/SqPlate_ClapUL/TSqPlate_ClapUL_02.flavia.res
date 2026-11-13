Gid Post Results File 1.0 
### 
# MAT-fem Plate T RM v1.1 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 0.0         00000  
     2 0.0 0.0         00000  
     3 0.0 0.0         00000  
     4 0.0 0.0 -1.78571e+000  
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
     4 -5.12275e-017 -7.16854e-019 0.0  
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
     1  4.16667e+000         00000         00000  
     2  1.87500e+001  5.20833e+000 -1.04167e+001  
     3  1.87500e+001  1.04167e+001 -5.20833e+000  
     4         00000         00000         00000  
     5  8.33333e+000  5.20833e+000  5.20833e+000  
     6  8.33333e+000 -5.20833e+000 -5.20833e+000  
     7  1.87500e+001 -5.20833e+000  1.04167e+001  
     8  1.87500e+001 -1.04167e+001  5.20833e+000  
     9  4.16667e+000         00000         00000  
End Values 
# 
Result "Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mx", "My", "Mxy" 
Values 
     1         00000          00000          00000 
     2  3.38649e-018   9.28969e-019  -2.37389e-018 
     3  6.81599e-018   2.00131e-018  -1.16185e-018 
     4  2.56791e-034          00000   4.01235e-036 
     5  5.14425e-018   1.60851e-018   1.81805e-018 
     6 -5.14425e-018  -1.60851e-018  -1.81805e-018 
     7 -3.38649e-018  -9.28969e-019   2.37389e-018 
     8 -6.81599e-018  -2.00131e-018   1.16185e-018 
     9         00000          00000          00000 
End Values 
Result "Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Qx", "Qy", "Zeros" 
Values 
     1         00000          00000  0.0 
     2 -4.16667e-001   8.33333e-001  0.0 
     3 -8.33333e-001   4.16667e-001  0.0 
     4  1.48030e-016   2.78776e-019  0.0 
     5 -6.25000e-001  -6.25000e-001  0.0 
     6  6.25000e-001   6.25000e-001  0.0 
     7  4.16667e-001  -8.33333e-001  0.0 
     8  8.33333e-001  -4.16667e-001  0.0 
     9         00000          00000  0.0 
End Values 
