Gid Post Results File 1.0 
### 
# MAT-fem Timoshenko Beam v1.3 
# 
GaussPoints "GPTR" Elemtype Linear 
Number of Gauss Points: 2 
Natural Coordinates: Internal 
end gausspionts 
# 
Result "Displacement" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Displ", "Y-Displ", "Z-Displ" 
Values 
     1 0.0 -2.68533e-004 0.0  
     2 0.0 -1.69967e-004 0.0  
     3 0.0 -8.39746e-005 0.0  
     4 0.0 -2.31278e-005 0.0  
     5 0.0         00000 0.0  
End Values 
# 
Result "Rotation" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Rot", "Y-Rot", "Z-Rot" 
Values 
     1 0.0 0.0 -4.02337e-005 
     2 0.0 0.0 -3.77191e-005 
     3 0.0 0.0 -3.01752e-005 
     4 0.0 0.0 -1.76022e-005 
     5 0.0 0.0         00000 
End Values 
# 
Result "Reaction Force" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Force", "Y-Force", "Z-Force" 
Values 
     1 0.0         00000 0.0  
     2 0.0         00000 0.0  
     3 0.0         00000 0.0  
     4 0.0         00000 0.0  
     5 0.0  5.00000e+000 0.0  
End Values 
# 
Result "Reaction Moment" "Load Analysis"  1  Vector OnNodes 
ComponentNames "X-Moment", "Y-Moment", "Z-Moment" 
Values 
     1 0.0 0.0         00000 
     2 0.0 0.0         00000 
     3 0.0 0.0         00000 
     4 0.0 0.0         00000 
     5 0.0 0.0  5.00000e+001 
End Values 
# 
Result "Moment and Shear" "Load Analysis"  1  Vector OnNodes 
ComponentNames "Mz", "Qy", "Zero" 
Values 
     1 -4.29159e-001  -5.00000e+000  0.0 
     2 -8.58318e-001  -5.00000e+000  0.0 
     3 -1.71664e+000  -5.00000e+000  0.0 
     4 -2.57495e+000  -5.00000e+000  0.0 
     5 -3.00411e+000  -5.00000e+000  0.0 
End Values 
